import { document } from "src/utils/dynamoDBClient";
import chromium from "chrome-aws-lambda";
import path from "path";
import fs from "fs";
import handlebars from "handlebars";
import { S3 } from "aws-sdk";



interface ICreateCertificate {
    id: string
    name: string
    grade: string
}
interface ITemplate {
    id: string
    name: string
    grade: string
    date: string
    medal: string
}
const compile = async function(data:ITemplate) {
    const filePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "certificate.hbs"
    )

    const template = fs.readFileSync(filePath, "utf-8")

    return handlebars.compile(template)(data)
}

export const handle = async (event) => {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate

    const response = await document.query({
        TableName: "users_certificates",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": id
        }
    }).promise()
    const userAlreadyExists = response.Items[0]

    if(!userAlreadyExists){
        await document.put({
            TableName: "users_certificates",
            Item: {
                id, 
                name, 
                grade
            }
        }).promise()
    }

    const medalPath = path.join(
        process.cwd(),
        "src",
        "templates",
        "selo.png"
    )
    const medal = fs.readFileSync(medalPath, "base64")
    const data: ITemplate = {
        id,
        grade,
        name,
        date: new Date().toLocaleDateString(),
        medal
    }
    
    const content = await compile(data)

    const browser = await chromium.puppeteer.launch({
        headless: true,
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath
    })

    const page = await browser.newPage()
    await page.setContent(content)

    const pdf = await page.pdf({
        format: "a4",
        landscape: true,
        path: process.env.IS_OFFLINE ? "cert.pdf": null,
        printBackground: true,
        preferCSSPageSize: true
    })

    await browser.close()

    const s3 = new S3()
    await s3.putObject({
        Bucket: "ignite-certificate-s3",
        Key: `${id}.pdf`,
        ACL: "public-read",
        Body: pdf,
        ContentType: "application/pdf"
    }).promise()

    return{
        statusCode: 201,
        body: JSON.stringify(
            {
                message: "Certificate created successfully!",
                url: `https://ignite-certificate-s3.s3.sa-east-1.amazonaws.com/${id}.pdf`
            }
        ),
        headers:{
            "Content-Type": "application/json"
        }
    }
}