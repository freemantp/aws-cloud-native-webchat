import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event, context) => {

  try {

    const apiGwClient = new ApiGatewayManagementApiClient({
      apiVersion: '2018-11-29',
      endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });

    const postCommand = new PostToConnectionCommand({
      ConnectionId: event.requestContext.connectionId,
      Data: "ping"
    });

    await apiGwClient.send(postCommand);

    return { statusCode: 200, };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, };
  }
};
