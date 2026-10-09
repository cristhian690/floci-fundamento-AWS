
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");

// Cliente AWS Textract
const {
    TextractClient,
    DetectDocumentTextCommand
} = require("@aws-sdk/client-textract");

// Configuración del mock
const { mockClient } = require("aws-sdk-client-mock");

const textractMock = mockClient(TextractClient);

// Respuesta personalizada

textractMock.on(DetectDocumentTextCommand).resolves({
    Blocks: [
        {
            BlockType: "LINE",
            Text: "Floci",
            Confidence: 99.0
        },
        {
            BlockType: "LINE",
            Text: "Documento PDF procesado correctamente",
            Confidence: 98.5
        }
    ]
});

const app = express();
const port = process.env.PORT || 3000;

// Cliente AWS Textract
const textractClient = new TextractClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: "http://localhost:4566",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    }
});

// Configuración de Multer para PDF
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten archivos PDF"));
        }
    }
});

// Archivos HTML
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Ruta para analizar el PDF
app.post("/api/analizar", (req, res) => {

    upload.single("documento")(req, res, async (error) => {

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "Debe seleccionar un PDF"
                });
            }

            // Crear comando AWS Textract
            const command = new DetectDocumentTextCommand({
                Document: {
                    Bytes: req.file.buffer
                }
            });

            console.log("Enviando documento a Textract...");

            // Respuesta simulada del mock
            const response = await textractClient.send(command);

            console.log("Respuesta de Textract:", response);

            // Extraer texto y confianza
            const textos = (response.Blocks || [])
                .filter(block => block.BlockType === "LINE")
                .map(block => ({
                    texto: block.Text,
                    confianza: block.Confidence
                }));

            // Enviar resultados al frontend
            return res.json({
                success: true,
                textos: textos
            });

        } catch (error) {

            console.error("Error AWS Textract:", error);

            return res.status(500).json({
                success: false,
                error: "Error al analizar el documento",
                details: error.message
            });

        }

    });

});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
