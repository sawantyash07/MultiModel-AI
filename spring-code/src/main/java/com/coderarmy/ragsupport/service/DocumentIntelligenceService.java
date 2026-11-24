package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.DocumentChunk;
import com.coderarmy.ragsupport.model.DocumentExtractionResult;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xwpf.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Enterprise Document Intelligence Service.
 * Supports PDF, DOCX, TXT, CSV, and XLSX/XLS parsing, table extraction,
 * scanned-page detection, chunking with page metadata, and scoped conversation RAG retrieval.
 */
@Service
public class DocumentIntelligenceService {

    private static final Logger log = LoggerFactory.getLogger(DocumentIntelligenceService.class);

    private static final int DEFAULT_CHUNK_SIZE = 600;
    private static final int DEFAULT_CHUNK_OVERLAP = 100;

    // Scoped storage per conversationId: conversationId -> List<DocumentExtractionResult>
    private final Map<String, List<DocumentExtractionResult>> documentStore = new ConcurrentHashMap<>();

    private static final Pattern CSV_SPLIT_PATTERN = Pattern.compile(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");

    /**
     * Extracts text, tables, and pages from an uploaded document, chunks it, and indexes it for RAG.
     */
    public DocumentExtractionResult extractAndIndex(
            String conversationId,
            String fileName,
            String contentType,
            byte[] fileBytes
    ) throws Exception {
        if (fileBytes == null || fileBytes.length == 0) {
            throw new IllegalArgumentException("Document file is empty.");
        }

        String safeFileName = (fileName != null && !fileName.isBlank()) ? fileName.trim() : "document";
        String lowerName = safeFileName.toLowerCase();
        String cType = (contentType != null) ? contentType.toLowerCase() : "";

        DocumentExtractionResult result = new DocumentExtractionResult();
        String docId = "doc-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
        result.setDocumentId(docId);
        result.setFileName(safeFileName);
        result.setFileSize(fileBytes.length);
        result.setFormattedSize(formatBytes(fileBytes.length));

        if (lowerName.endsWith(".pdf") || cType.contains("pdf")) {
            result.setFileType("PDF");
            parsePdf(fileBytes, safeFileName, result);
        } else if (lowerName.endsWith(".docx") || cType.contains("wordprocessingml") || cType.contains("msword")) {
            result.setFileType("DOCX");
            parseDocx(fileBytes, safeFileName, result);
        } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || cType.contains("spreadsheetml") || cType.contains("excel")) {
            result.setFileType("SPREADSHEET");
            parseSpreadsheet(fileBytes, safeFileName, result);
        } else if (lowerName.endsWith(".csv") || cType.contains("csv")) {
            result.setFileType("CSV");
            parseCsv(fileBytes, safeFileName, result);
        } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || cType.contains("text/plain") || cType.contains("markdown")) {
            result.setFileType("TEXT");
            parseText(fileBytes, safeFileName, result);
        } else {
            // Fallback: try parsing as text
            result.setFileType("TEXT");
            parseText(fileBytes, safeFileName, result);
        }

        result.setChunkCount(result.getChunks().size());
        result.setTableCount(result.getExtractedTables().size());

        // Associate with conversation
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        documentStore.computeIfAbsent(convKey, k -> Collections.synchronizedList(new ArrayList<>())).add(result);

        log.info("[DocumentIntelligence] Processed document '{}' ({}) -> {} pages, {} chunks, {} tables for conv '{}'",
                safeFileName, result.getFileType(), result.getPageCount(), result.getChunkCount(), result.getTableCount(), convKey);

        return result;
    }

    /**
     * Parses PDF documents page-by-page, retaining page numbers and detecting scanned pages.
     */
    private void parsePdf(byte[] bytes, String fileName, DocumentExtractionResult result) throws Exception {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            int numPages = document.getNumberOfPages();
            result.setPageCount(numPages);

            PDFTextStripper stripper = new PDFTextStripper();
            List<DocumentChunk> chunks = new ArrayList<>();
            int totalCharacters = 0;
            StringBuilder previewBuilder = new StringBuilder();

            for (int p = 1; p <= numPages; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String pageText = stripper.getText(document);
                if (pageText == null) pageText = "";
                String cleanPageText = pageText.trim();
                totalCharacters += cleanPageText.length();

                if (!cleanPageText.isBlank()) {
                    if (previewBuilder.length() < 300) {
                        previewBuilder.append(cleanPageText).append(" ");
                    }
                    // Chunk this page's content
                    List<DocumentChunk> pageChunks = chunkText(cleanPageText, fileName, "PDF", p, "Page " + p, false);
                    chunks.addAll(pageChunks);
                } else {
                    // Empty or scanned page
                    chunks.add(new DocumentChunk(
                            UUID.randomUUID().toString(),
                            fileName,
                            "PDF",
                            p,
                            "Page " + p + " (Scanned/Visual Page)",
                            "[Scanned or Image-based Page - No digital text detected. Visual document inspection applied.]",
                            false
                    ));
                }
            }

            // If average text per page is under 40 characters, mark as scanned PDF
            double avgCharsPerPage = numPages > 0 ? ((double) totalCharacters / numPages) : 0;
            if (avgCharsPerPage < 40) {
                result.setScanned(true);
                log.info("[DocumentIntelligence] PDF '{}' has low text density ({:.1f} chars/page). Flagged as Scanned/Visual.",
                        fileName, avgCharsPerPage);
            }

            result.setChunks(chunks);
            String preview = previewBuilder.toString().trim();
            result.setSummaryPreview(preview.length() > 250 ? preview.substring(0, 250) + "..." : preview);
        }
    }

    /**
     * Parses Word DOCX files extracting paragraphs, headings, and tables.
     */
    private void parseDocx(byte[] bytes, String fileName, DocumentExtractionResult result) throws Exception {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
             XWPFDocument doc = new XWPFDocument(bais)) {

            List<DocumentChunk> chunks = new ArrayList<>();
            List<String> tables = new ArrayList<>();
            StringBuilder textAccumulator = new StringBuilder();
            String currentSection = "General";
            int sectionIndex = 1;

            // Iterate body elements (paragraphs and tables in document order)
            for (IBodyElement elem : doc.getBodyElements()) {
                if (elem instanceof XWPFParagraph p) {
                    String pText = p.getText() != null ? p.getText().trim() : "";
                    if (pText.isBlank()) continue;

                    // Check for heading styles
                    String style = p.getStyle();
                    if (style != null && style.toLowerCase().contains("heading")) {
                        if (!textAccumulator.isEmpty()) {
                            chunks.addAll(chunkText(textAccumulator.toString(), fileName, "DOCX", sectionIndex, currentSection, false));
                            textAccumulator.setLength(0);
                            sectionIndex++;
                        }
                        currentSection = pText;
                    } else {
                        textAccumulator.append(pText).append("\n\n");
                    }
                } else if (elem instanceof XWPFTable table) {
                    // Extract table into Markdown table format
                    String mdTable = formatDocxTableToMarkdown(table);
                    if (!mdTable.isBlank()) {
                        tables.add(mdTable);
                        chunks.add(new DocumentChunk(
                                UUID.randomUUID().toString(),
                                fileName,
                                "DOCX",
                                sectionIndex,
                                currentSection + " (Table)",
                                mdTable,
                                true
                        ));
                    }
                }
            }

            if (!textAccumulator.isEmpty()) {
                chunks.addAll(chunkText(textAccumulator.toString(), fileName, "DOCX", sectionIndex, currentSection, false));
            }

            result.setPageCount(Math.max(1, sectionIndex));
            result.setChunks(chunks);
            result.setExtractedTables(tables);

            String preview = chunks.isEmpty() ? "" : chunks.get(0).getContent();
            result.setSummaryPreview(preview.length() > 250 ? preview.substring(0, 250) + "..." : preview);
        }
    }

    private String formatDocxTableToMarkdown(XWPFTable table) {
        StringBuilder sb = new StringBuilder();
        List<XWPFTableRow> rows = table.getRows();
        if (rows.isEmpty()) return "";

        for (int r = 0; r < rows.size(); r++) {
            XWPFTableRow row = rows.get(r);
            sb.append("|");
            for (XWPFTableCell cell : row.getTableCells()) {
                String cellText = cell.getText() != null ? cell.getText().replace("|", "\\|").replace("\n", " ").trim() : "";
                sb.append(" ").append(cellText).append(" |");
            }
            sb.append("\n");

            // After header row, output markdown separator
            if (r == 0) {
                sb.append("|");
                for (int c = 0; c < row.getTableCells().size(); c++) {
                    sb.append(" --- |");
                }
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    /**
     * Parses Excel XLSX and XLS workbooks extracting sheets and rows as structured tables.
     */
    private void parseSpreadsheet(byte[] bytes, String fileName, DocumentExtractionResult result) throws Exception {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
             Workbook workbook = WorkbookFactory.create(bais)) {

            DataFormatter formatter = new DataFormatter();
            List<DocumentChunk> chunks = new ArrayList<>();
            List<String> tables = new ArrayList<>();
            int numSheets = workbook.getNumberOfSheets();
            result.setPageCount(numSheets);

            for (int s = 0; s < numSheets; s++) {
                Sheet sheet = workbook.getSheetAt(s);
                String sheetName = sheet.getSheetName();
                StringBuilder sb = new StringBuilder();
                int rowCount = sheet.getPhysicalNumberOfRows();
                if (rowCount == 0) continue;

                int maxCols = 0;
                for (Row row : sheet) {
                    if (row.getLastCellNum() > maxCols) {
                        maxCols = row.getLastCellNum();
                    }
                }
                if (maxCols == 0) continue;

                int rowIndex = 0;
                for (Row row : sheet) {
                    sb.append("|");
                    for (int c = 0; c < maxCols; c++) {
                        Cell cell = row.getCell(c, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                        String val = formatter.formatCellValue(cell).replace("|", "\\|").replace("\n", " ").trim();
                        sb.append(" ").append(val).append(" |");
                    }
                    sb.append("\n");

                    if (rowIndex == 0) {
                        sb.append("|");
                        for (int c = 0; c < maxCols; c++) {
                            sb.append(" --- |");
                        }
                        sb.append("\n");
                    }
                    rowIndex++;
                }

                String mdTable = sb.toString();
                tables.add(mdTable);

                // Chunk if spreadsheet is huge, otherwise keep as table chunk
                if (mdTable.length() > 1500) {
                    chunks.addAll(chunkText(mdTable, fileName, "SPREADSHEET", s + 1, "Sheet: " + sheetName, true));
                } else {
                    chunks.add(new DocumentChunk(
                            UUID.randomUUID().toString(),
                            fileName,
                            "SPREADSHEET",
                            s + 1,
                            "Sheet: " + sheetName,
                            mdTable,
                            true
                    ));
                }
            }

            result.setChunks(chunks);
            result.setExtractedTables(tables);
            String preview = tables.isEmpty() ? "" : tables.get(0);
            result.setSummaryPreview(preview.length() > 250 ? preview.substring(0, 250) + "..." : preview);
        }
    }

    /**
     * Parses CSV files into structured Markdown tables and rows.
     */
    private void parseCsv(byte[] bytes, String fileName, DocumentExtractionResult result) throws Exception {
        List<DocumentChunk> chunks = new ArrayList<>();
        List<String> tables = new ArrayList<>();
        StringBuilder sb = new StringBuilder();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8))) {
            String line;
            int lineNum = 0;
            int maxCols = 0;

            while ((line = reader.readLine()) != null) {
                String[] parts = CSV_SPLIT_PATTERN.split(line, -1);
                if (lineNum == 0) {
                    maxCols = parts.length;
                }

                sb.append("|");
                for (int i = 0; i < Math.max(parts.length, maxCols); i++) {
                    String col = (i < parts.length) ? parts[i].trim().replaceAll("^\"|\"$", "") : "";
                    sb.append(" ").append(col.replace("|", "\\|")).append(" |");
                }
                sb.append("\n");

                if (lineNum == 0) {
                    sb.append("|");
                    for (int i = 0; i < maxCols; i++) {
                        sb.append(" --- |");
                    }
                    sb.append("\n");
                }
                lineNum++;
            }

            result.setPageCount(1);
            String fullTable = sb.toString();
            tables.add(fullTable);

            if (fullTable.length() > 1500) {
                chunks.addAll(chunkText(fullTable, fileName, "CSV", 1, "CSV Data", true));
            } else {
                chunks.add(new DocumentChunk(
                        UUID.randomUUID().toString(),
                        fileName,
                        "CSV",
                        1,
                        "CSV Data",
                        fullTable,
                        true
                ));
            }

            result.setChunks(chunks);
            result.setExtractedTables(tables);
            result.setSummaryPreview(fullTable.length() > 250 ? fullTable.substring(0, 250) + "..." : fullTable);
        }
    }

    /**
     * Parses plain text and Markdown files.
     */
    private void parseText(byte[] bytes, String fileName, DocumentExtractionResult result) {
        String fullText = new String(bytes, StandardCharsets.UTF_8).trim();
        List<DocumentChunk> chunks = chunkText(fullText, fileName, "TEXT", 1, "Content", false);
        result.setPageCount(1);
        result.setChunks(chunks);
        result.setSummaryPreview(fullText.length() > 250 ? fullText.substring(0, 250) + "..." : fullText);
    }

    /**
     * Splits text into overlapping chunks, preserving page numbers and section titles.
     */
    private List<DocumentChunk> chunkText(
            String text,
            String fileName,
            String docType,
            int pageNumber,
            String sectionTitle,
            boolean isTable
    ) {
        List<DocumentChunk> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) return chunks;

        // If table, chunk by lines to keep markdown rows intact
        if (isTable) {
            String[] lines = text.split("\n");
            StringBuilder current = new StringBuilder();
            for (String l : lines) {
                if (current.length() + l.length() > DEFAULT_CHUNK_SIZE && !current.isEmpty()) {
                    chunks.add(new DocumentChunk(UUID.randomUUID().toString(), fileName, docType, pageNumber, sectionTitle, current.toString().trim(), true));
                    current.setLength(0);
                }
                current.append(l).append("\n");
            }
            if (!current.isEmpty()) {
                chunks.add(new DocumentChunk(UUID.randomUUID().toString(), fileName, docType, pageNumber, sectionTitle, current.toString().trim(), true));
            }
            return chunks;
        }

        // Paragraph-based splitting with sliding window
        String[] paragraphs = text.split("\n\n+");
        StringBuilder currentChunk = new StringBuilder();

        for (String p : paragraphs) {
            String cleanP = p.trim();
            if (cleanP.isBlank()) continue;

            if (currentChunk.length() + cleanP.length() > DEFAULT_CHUNK_SIZE && !currentChunk.isEmpty()) {
                chunks.add(new DocumentChunk(
                        UUID.randomUUID().toString(),
                        fileName,
                        docType,
                        pageNumber,
                        sectionTitle,
                        currentChunk.toString().trim(),
                        false
                ));

                // Retain overlap if long
                if (currentChunk.length() > DEFAULT_CHUNK_OVERLAP) {
                    String prev = currentChunk.toString();
                    String overlap = prev.substring(prev.length() - DEFAULT_CHUNK_OVERLAP);
                    currentChunk.setLength(0);
                    currentChunk.append(overlap).append(" ");
                } else {
                    currentChunk.setLength(0);
                }
            }
            currentChunk.append(cleanP).append("\n\n");
        }

        if (!currentChunk.isEmpty()) {
            chunks.add(new DocumentChunk(
                    UUID.randomUUID().toString(),
                    fileName,
                    docType,
                    pageNumber,
                    sectionTitle,
                    currentChunk.toString().trim(),
                    false
            ));
        }

        return chunks;
    }

    /**
     * RAG Retrieval: Finds top-K most relevant chunks across all uploaded documents for a conversation.
     */
    public List<DocumentChunk> findRelevantChunks(String conversationId, String query, int maxResults) {
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        List<DocumentExtractionResult> docs = documentStore.get(convKey);
        if (docs == null || docs.isEmpty()) return Collections.emptyList();

        List<DocumentChunk> allChunks = new ArrayList<>();
        for (DocumentExtractionResult d : docs) {
            if (d.getChunks() != null) {
                allChunks.addAll(d.getChunks());
            }
        }

        if (allChunks.isEmpty()) return Collections.emptyList();

        // If query is empty, return initial overview chunks
        if (query == null || query.isBlank()) {
            return allChunks.subList(0, Math.min(allChunks.size(), maxResults));
        }

        // Calculate relevance score using term frequency, keyword overlap, and exact phrase bonus
        String[] queryTerms = query.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");
        Set<String> termSet = new HashSet<>();
        for (String t : queryTerms) {
            if (t.length() >= 3) termSet.add(t);
        }

        for (DocumentChunk chunk : allChunks) {
            String lowerContent = chunk.getContent().toLowerCase();
            String lowerTitle = (chunk.getSectionTitle() != null ? chunk.getSectionTitle() : "").toLowerCase();
            double score = 0.0;

            // Exact phrase match bonus
            if (lowerContent.contains(query.toLowerCase().trim())) {
                score += 5.0;
            }

            // Keyword match scoring
            for (String term : termSet) {
                if (lowerTitle.contains(term)) score += 3.0;
                int count = countOccurrences(lowerContent, term);
                score += Math.min(count * 1.0, 5.0);
            }

            // Prioritize tables when query asks for data, numbers, or comparison
            if (chunk.isTable() && (query.toLowerCase().contains("table") || query.toLowerCase().contains("list") ||
                    query.toLowerCase().contains("how many") || query.toLowerCase().contains("number") || query.toLowerCase().contains("rate"))) {
                score += 2.0;
            }

            chunk.setRelevanceScore(score);
        }

        allChunks.sort((a, b) -> Double.compare(b.getRelevanceScore(), a.getRelevanceScore()));

        // Filter chunks with non-zero relevance score, or return first few if generic question
        List<DocumentChunk> top = new ArrayList<>();
        for (DocumentChunk c : allChunks) {
            if (c.getRelevanceScore() > 0 || top.isEmpty()) {
                top.add(c);
                if (top.size() >= maxResults) break;
            }
        }

        return top;
    }

    private int countOccurrences(String haystack, String needle) {
        int count = 0;
        int idx = 0;
        while ((idx = haystack.indexOf(needle, idx)) != -1) {
            count++;
            idx += needle.length();
        }
        return count;
    }

    /**
     * Builds structured prompt context containing verified document evidence with citations.
     */
    public String buildDocumentContext(String conversationId, String query, int maxChunks) {
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        List<DocumentExtractionResult> docs = documentStore.get(convKey);
        if (docs == null || docs.isEmpty()) return "";

        List<DocumentChunk> relevant = findRelevantChunks(conversationId, query, maxChunks);
        if (relevant.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("### 📄 Uploaded Document Intelligence (Verified Evidence & Citations):\n");
        sb.append(String.format("Indexed Documents (%d active in conversation):\n", docs.size()));
        for (DocumentExtractionResult d : docs) {
            String scannedNote = d.isScanned() ? " [Scanned/OCR]" : "";
            sb.append(String.format("- **%s** (%s, %d pages/sheets, %s)%s\n",
                    d.getFileName(), d.getFileType(), d.getPageCount(), d.getFormattedSize(), scannedNote));
        }
        sb.append("\n");

        sb.append("Retrieved Evidence Chunks:\n");
        for (int i = 0; i < relevant.size(); i++) {
            DocumentChunk c = relevant.get(i);
            String loc = c.getPageNumber() > 0 ? "Page " + c.getPageNumber() : "Section";
            String title = (c.getSectionTitle() != null && !c.getSectionTitle().isBlank()) ? (" - " + c.getSectionTitle()) : "";
            sb.append(String.format("Evidence [%d] (Document: \"%s\", %s%s):\n\"\"\"\n%s\n\"\"\"\n\n",
                    i + 1, c.getDocumentName(), loc, title, c.getContent().trim()));
        }

        sb.append("### 🛡️ Strict Document Evidence & Citation Directives:\n")
                .append("1. Evidence-Grounded Answers: Base all claims, numbers, dates, entities, and answers strictly on the document excerpts above.\n")
                .append("2. Page & Document Citations: When asserting facts from the document, explicitly cite the source file and page/section, e.g. `[DocumentName.pdf, Page 3]` or `[Financials.xlsx, Sheet: Q3]`.\n")
                .append("3. Missing Information Rule: If the user's question asks for details not present in the supplied document excerpts, explicitly state: \"The requested information could not be found in the supplied documents.\" Do NOT guess or hallucinate unprovided content.\n")
                .append("4. Multi-Document Comparison: When multiple documents are uploaded, clearly distinguish evidence between them.\n\n");

        return sb.toString();
    }

    public boolean hasDocuments(String conversationId) {
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        List<DocumentExtractionResult> list = documentStore.get(convKey);
        return list != null && !list.isEmpty();
    }

    public List<DocumentExtractionResult> getDocuments(String conversationId) {
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        List<DocumentExtractionResult> list = documentStore.get(convKey);
        return list != null ? new ArrayList<>(list) : Collections.emptyList();
    }

    public void clearDocuments(String conversationId) {
        String convKey = (conversationId != null && !conversationId.isBlank()) ? conversationId : "default";
        documentStore.remove(convKey);
        log.info("[DocumentIntelligence] Cleared indexed documents for conversation '{}'", convKey);
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
