import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from "src/utils/dynamoDBClient"

export const handle: APIGatewayProxyHandler = async (event) => {
    const { id } = event.pathParameters

    const response = await document.query({
        TableName: "users_certificates",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": id
        }
    }).promise()

    const userCertificate = response.Items[0]

    if(userCertificate){
        return{
            statusCode: 200,
            body: JSON.stringify({
                message: "Certifcado válido",
                name: userCertificate.name,
                url: `https://ignite-certificate-s3.s3.sa-east-1.amazonaws.com/${id}.pdf`
            })
        }
    }
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Certificado inválido. É cilada"
        })
    }
}