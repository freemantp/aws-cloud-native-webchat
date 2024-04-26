import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});

export const handler = async (event, context) => {

  try {

    const messageContent = JSON.parse(event.body).message;

    const scanCommand = new ScanCommand({
      TableName: process.env.connectionsTable,
      ProjectionExpression: "connectionId, userHandle, translationLang",
    });

    const connections = await dynamo.send(scanCommand);

    // Extract the caller's name to be included in the response
    const callerUsername = connections.Items.find(item => item.connectionId === event.requestContext.connectionId).userHandle || undefined;

    //Group connectionIDs by language, we want to invoke a single translation per language and deliver it to all recipients
    const translationMap = connections.Items
      .filter((item) => item.connectionId != event.requestContext.connectionId) //don't include the sender's connectionID
      .reduce((acc, item) => {

        if (!acc[item.translationLang]) {
          acc[item.translationLang] = [];
        }

        acc[item.translationLang].push(item.connectionId);
        return acc;
      }, {});


    const recipientsConnectionIDs = undefined in translationMap
      ? translationMap[undefined]
      : []

    await deliverMessages(recipientsConnectionIDs, callerUsername, messageContent, event.requestContext)

    await initiateTranslation(translationMap, messageContent, callerUsername);

    await persistMessage(callerUsername, messageContent, event.requestContext);

    return { statusCode: 200, };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, };
  }
};

async function deliverMessages(recipientsConnectionIDs, callerUsername, messageContent, requestContext) { 

  const apiGwClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: `https://${requestContext.domainName}/${requestContext.stage}`
  });

  if (recipientsConnectionIDs.length > 0) {
    // Deliver the untranslated message to each individual recipient
    const sendMessages = recipientsConnectionIDs.map(async (connectionID) => {
      try {
        const postCommand = new PostToConnectionCommand({
          ConnectionId: connectionID,
          Data: JSON.stringify({ message: messageContent, userHandle: callerUsername })
        });

        await apiGwClient.send(postCommand);
      } catch (e) {
        console.error(`Error delivering message to ${connectionID}, reason:`, e);
      }
    });

    await Promise.all(sendMessages);
  }
}

async function persistMessage(callerUsername, messageContent, requestContext) {
  const currentEpoch = Math.floor(requestContext.requestTimeEpoch / 1000);
  const SIXTY_MINUTES = 3600;

  const saveMsgCommand = new PutCommand({
    TableName: process.env.messagesTable,
    Item: {
      userHandle: callerUsername,
      timestamp: currentEpoch,
      ttl: currentEpoch + SIXTY_MINUTES,
      message: messageContent
    }
  });

  await dynamo.send(saveMsgCommand);
}

async function initiateTranslation(translationMap, messageContent, callerUsername) {

  const translationRequired = Object.keys(translationMap).some(lang => lang !== 'undefined');

  if (translationRequired) {    

    const translationPromises = Object.entries(translationMap)
      .filter(([lang, ids]) => lang !== 'undefined')
      .map(([lang, ids]) => JSON.stringify({
        text: messageContent,
        user: callerUsername,
        lang: lang,
        connectionIDs: ids

      }))
      .map(messagePayload => snsClient.send(new PublishCommand({
        Message: messagePayload,
        TopicArn: process.env.translationTopic,
      })));

    await Promise.all(translationPromises)
  }
}