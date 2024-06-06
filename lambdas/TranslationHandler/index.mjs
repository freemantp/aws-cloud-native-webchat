import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const client = new TranslateClient({
  region: "eu-central-1",
});

const apiGwClient = new ApiGatewayManagementApiClient({
  apiVersion: '2018-11-29',
  endpoint: process.env.apiGwEndpoint
});

export const handler = async (event, context, callback) => {

  var translationRequest = JSON.parse(event.Records[0].Sns.Message);

  const translationInput = {
    Text: translationRequest.text,
    SourceLanguageCode: "auto",
    TargetLanguageCode: translationRequest.lang,
    Settings: {
      Formality: "INFORMAL",
      Brevity: "ON",
    },
  };

  const translationResponse = await client.send(new TranslateTextCommand(translationInput));
  const messagePayload = JSON.stringify({ message: translationResponse.TranslatedText, userHandle: translationRequest.user });
  const apiRequests = translationRequest.connectionIDs.map(connectionID => {
    apiGwClient.send(new PostToConnectionCommand({
      ConnectionId: connectionID,
      Data: messagePayload
    }));
  });

  await Promise.all(apiRequests);
  console.log(messagePayload);

};
