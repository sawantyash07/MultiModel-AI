package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.DocumentChunk;
import com.coderarmy.ragsupport.model.DocumentExtractionResult;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class DocumentIntelligenceServiceTest {

    private DocumentIntelligenceService documentService;

    @BeforeEach
    public void setUp() {
        documentService = new DocumentIntelligenceService();
    }

    @Test
    @DisplayName("Test CSV document parsing, table generation and search retrieval")
    public void testCsvParsingAndRetrieval() throws Exception {
        String csvContent = "Quarter,Revenue,Profit,Growth\n" +
                "Q1 2024,$120M,$25M,+14%\n" +
                "Q2 2024,$145M,$32M,+21%\n" +
                "Q3 2024,$180M,$45M,+28%\n";
        byte[] csvBytes = csvContent.getBytes(StandardCharsets.UTF_8);

        DocumentExtractionResult res = documentService.extractAndIndex(
                "test-conv-1",
                "financial_report.csv",
                "text/csv",
                csvBytes
        );

        assertNotNull(res);
        assertEquals("CSV", res.getFileType());
        assertEquals("financial_report.csv", res.getFileName());
        assertEquals(1, res.getPageCount());
        assertTrue(res.getTableCount() >= 1);
        assertFalse(res.getChunks().isEmpty());

        // Test retrieval
        List<DocumentChunk> chunks = documentService.findRelevantChunks("test-conv-1", "Revenue in Q3", 3);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.get(0).getContent().contains("$180M"));

        // Test prompt context construction
        String context = documentService.buildDocumentContext("test-conv-1", "Revenue", 3);
        assertTrue(context.contains("financial_report.csv"));
        assertTrue(context.contains("Verified Evidence"));
        assertTrue(context.contains("Strict Document Evidence & Citation Directives"));
    }

    @Test
    @DisplayName("Test Text document parsing and chunking")
    public void testTextParsingAndChunking() throws Exception {
        String text = "Project Architecture Guidelines:\n\n" +
                "The system must use Spring Boot for backend microservices and React for frontend single-page apps.\n\n" +
                "Database security requires encrypted connections and secrets must never be logged.\n";
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);

        DocumentExtractionResult res = documentService.extractAndIndex(
                "test-conv-2",
                "guidelines.txt",
                "text/plain",
                bytes
        );

        assertEquals("TEXT", res.getFileType());
        assertFalse(res.getChunks().isEmpty());

        List<DocumentChunk> chunks = documentService.findRelevantChunks("test-conv-2", "Spring Boot architecture", 2);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.get(0).getContent().contains("Spring Boot"));
    }

    @Test
    @DisplayName("Test Excel XLSX document parsing and table extraction")
    public void testXlsxParsing() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Salaries");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Employee");
            header.createCell(1).setCellValue("Department");
            header.createCell(2).setCellValue("Salary");

            Row r1 = sheet.createRow(1);
            r1.createCell(0).setCellValue("Alice");
            r1.createCell(1).setCellValue("Engineering");
            r1.createCell(2).setCellValue("120000");

            Row r2 = sheet.createRow(2);
            r2.createCell(0).setCellValue("Bob");
            r2.createCell(1).setCellValue("Research");
            r2.createCell(2).setCellValue("135000");

            wb.write(baos);
        }

        DocumentExtractionResult res = documentService.extractAndIndex(
                "test-conv-3",
                "payroll.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                baos.toByteArray()
        );

        assertEquals("SPREADSHEET", res.getFileType());
        assertEquals(1, res.getPageCount());
        assertTrue(res.getTableCount() >= 1);

        List<DocumentChunk> chunks = documentService.findRelevantChunks("test-conv-3", "Bob salary in Research", 2);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.get(0).getContent().contains("135000"));
    }

    @Test
    @DisplayName("Test Word DOCX document parsing and headings")
    public void testDocxParsing() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFParagraph p1 = doc.createParagraph();
            XWPFRun r1 = p1.createRun();
            r1.setText("Product Specifications - AI Assistant Yash");

            XWPFParagraph p2 = doc.createParagraph();
            XWPFRun r2 = p2.createRun();
            r2.setText("Yash AI supports multimodal interactions including live web search, document intelligence, and voice conversation mode.");

            doc.write(baos);
        }

        DocumentExtractionResult res = documentService.extractAndIndex(
                "test-conv-4",
                "specs.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                baos.toByteArray()
        );

        assertEquals("DOCX", res.getFileType());
        assertFalse(res.getChunks().isEmpty());

        List<DocumentChunk> chunks = documentService.findRelevantChunks("test-conv-4", "voice conversation mode", 2);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.get(0).getContent().contains("Yash AI"));
    }

    @Test
    @DisplayName("Test PDF parsing with pages and metadata")
    public void testPdfParsing() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PDDocument doc = new PDDocument()) {
            PDPage page1 = new PDPage();
            doc.addPage(page1);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page1)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 14);
                cs.newLineAtOffset(50, 700);
                cs.showText("Page 1: Yash AI Architecture Overview and Capabilities.");
                cs.endText();
            }

            PDPage page2 = new PDPage();
            doc.addPage(page2);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page2)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText("Page 2: Security compliance protocols and data privacy encryption.");
                cs.endText();
            }

            doc.save(baos);
        }

        DocumentExtractionResult res = documentService.extractAndIndex(
                "test-conv-5",
                "architecture.pdf",
                "application/pdf",
                baos.toByteArray()
        );

        assertEquals("PDF", res.getFileType());
        assertEquals(2, res.getPageCount());
        assertFalse(res.isScanned());

        List<DocumentChunk> chunks = documentService.findRelevantChunks("test-conv-5", "security compliance protocols", 2);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.get(0).getContent().contains("Page 2") || chunks.get(0).getContent().contains("security compliance"));
    }

    @Test
    @DisplayName("Test conversation document scoping and isolation")
    public void testConversationIsolation() throws Exception {
        documentService.extractAndIndex(
                "user-a-conv",
                "secret_a.txt",
                "text/plain",
                "Secret token for User A: AlphaBravo".getBytes(StandardCharsets.UTF_8)
        );

        documentService.extractAndIndex(
                "user-b-conv",
                "secret_b.txt",
                "text/plain",
                "Secret token for User B: CharlieDelta".getBytes(StandardCharsets.UTF_8)
        );

        // User A's conversation must only see User A's document
        List<DocumentChunk> chunksA = documentService.findRelevantChunks("user-a-conv", "Secret token", 5);
        assertEquals(1, chunksA.size());
        assertTrue(chunksA.get(0).getContent().contains("AlphaBravo"));
        assertFalse(chunksA.get(0).getContent().contains("CharlieDelta"));

        // User B's conversation must only see User B's document
        List<DocumentChunk> chunksB = documentService.findRelevantChunks("user-b-conv", "Secret token", 5);
        assertEquals(1, chunksB.size());
        assertTrue(chunksB.get(0).getContent().contains("CharlieDelta"));
        assertFalse(chunksB.get(0).getContent().contains("AlphaBravo"));

        // Clear User A's documents
        documentService.clearDocuments("user-a-conv");
        assertFalse(documentService.hasDocuments("user-a-conv"));
        assertTrue(documentService.hasDocuments("user-b-conv"));
    }
}
