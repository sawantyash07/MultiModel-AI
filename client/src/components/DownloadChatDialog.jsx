import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  FileText,
  Code,
  Printer,
  Download,
  CheckCircle2,
  Highlighter,
  MessageSquare,
  AlignLeft,
  Sparkles
} from 'lucide-react';
import {
  exportToPdf,
  exportToHtml,
  exportToMarkdown,
  exportToText,
  printConversation,
  sanitizeFilename,
  reconcileConversationMessages,
  reconcileHighlights
} from '../services/conversationExport';
import { api } from '../services/api';

export default function DownloadChatDialog({
  open,
  onClose,
  conversation,
  messages = [],
  highlights = [],
  isGenerating = false
}) {
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(null);

  // Authoritative conversation messages & highlights synced from backend
  const [activeMessages, setActiveMessages] = useState(messages);
  const [activeHighlights, setActiveHighlights] = useState(highlights);
  const [authoritativeTitle, setAuthoritativeTitle] = useState(conversation?.title || 'Yash AI Conversation');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Guard against race conditions when switching conversations
  const activeFetchIdRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const fetchId = ++activeFetchIdRef.current;

    if (open) {
      setExportError(null);
      setExportSuccess(null);

      const initialPropsMessages = Array.isArray(messages) ? messages : [];
      const initialPropsHighlights = Array.isArray(highlights) ? highlights : [];

      setAuthoritativeTitle(conversation?.title || 'Yash AI Conversation');

      // Sync authoritative messages from database if conversation ID is present
      if (conversation?.id) {
        setIsLoadingHistory(true);
        // Immediately initialize with current props to avoid displaying stale data from prior dialog sessions
        setActiveMessages(initialPropsMessages);
        setActiveHighlights(initialPropsHighlights);

        Promise.all([
          api.getConversation(conversation.id).catch(err => {
            console.warn('[DownloadChatDialog] Could not fetch authoritative messages from backend:', err);
            return null;
          }),
          api.getHighlights(conversation.id).catch(err => {
            console.warn('[DownloadChatDialog] Could not fetch highlights from backend:', err);
            return null;
          })
        ]).then(([convData, hlData]) => {
          if (!isMounted || fetchId !== activeFetchIdRef.current) return;

          if (convData?.title) {
            setAuthoritativeTitle(convData.title);
          }

          const serverMsgs = (convData && Array.isArray(convData.messages)) ? convData.messages : [];
          const serverHls = (hlData && Array.isArray(hlData.highlights)) ? hlData.highlights : [];

          // Authoritative reconciliation: merge server history and in-memory live props messages
          const reconciledMessages = reconcileConversationMessages(serverMsgs, initialPropsMessages);
          setActiveMessages(reconciledMessages);

          const reconciledHighlights = reconcileHighlights(serverHls, initialPropsHighlights);
          setActiveHighlights(reconciledHighlights);
        }).finally(() => {
          if (isMounted && fetchId === activeFetchIdRef.current) {
            setIsLoadingHistory(false);
          }
        });
      } else {
        // New or unsaved conversation
        setActiveMessages(initialPropsMessages);
        setActiveHighlights(initialPropsHighlights);
        setIsLoadingHistory(false);
      }
    } else {
      setIsLoadingHistory(false);
      setExportError(null);
      setExportSuccess(null);
    }

    return () => {
      isMounted = false;
    };
  }, [open, conversation?.id]);

  const title = authoritativeTitle || conversation?.title || 'Yash AI Conversation';
  const effectiveMessages = activeMessages && activeMessages.length > 0 ? activeMessages : (messages || []);
  const effectiveHighlights = activeHighlights && activeHighlights.length > 0 ? activeHighlights : (highlights || []);
  const previewFilename = sanitizeFilename(title, selectedFormat === 'print' ? 'pdf' : selectedFormat);

  const handleExport = async () => {
    if (isLoadingHistory) {
      setExportError('Please wait while conversation history finishes syncing...');
      return;
    }

    if (effectiveMessages.length === 0) {
      setExportError('No messages to export in this conversation.');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      let downloadedFilename = '';
      if (selectedFormat === 'pdf') {
        downloadedFilename = await exportToPdf(conversation, effectiveMessages, effectiveHighlights);
        setExportSuccess(`Downloaded ${downloadedFilename}`);
      } else if (selectedFormat === 'html') {
        downloadedFilename = await exportToHtml(conversation, effectiveMessages, effectiveHighlights);
        setExportSuccess(`Downloaded ${downloadedFilename}`);
      } else if (selectedFormat === 'md') {
        downloadedFilename = await exportToMarkdown(conversation, effectiveMessages, effectiveHighlights);
        setExportSuccess(`Downloaded ${downloadedFilename}`);
      } else if (selectedFormat === 'txt') {
        downloadedFilename = await exportToText(conversation, effectiveMessages, effectiveHighlights);
        setExportSuccess(`Downloaded ${downloadedFilename}`);
      } else if (selectedFormat === 'print') {
        printConversation(conversation, effectiveMessages, effectiveHighlights);
        setExportSuccess('Opened browser print window');
      }

      setTimeout(() => {
        onClose();
        setExportSuccess(null);
      }, 1400);
    } catch (err) {
      console.error('[DownloadChatDialog] Export error:', err);
      setExportError(err.message || 'Failed to generate export file. Please try another format.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isExporting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Download size={22} color="#10a37f" />
        <span>Download Conversation</span>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Conversation Summary Box */}
        <Box sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 2,
          backgroundColor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.8
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              icon={<MessageSquare size={13} />}
              label={isLoadingHistory ? 'Syncing history...' : `${effectiveMessages.length} messages`}
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
            {effectiveHighlights.length > 0 && (
              <Chip
                size="small"
                icon={<Highlighter size={13} color="#f59e0b" />}
                label={`${effectiveHighlights.length} highlights`}
                variant="outlined"
                sx={{ fontSize: '0.75rem', height: 24, borderColor: '#f59e0b', color: '#d97706' }}
              />
            )}
            {isGenerating && (
              <Chip
                size="small"
                icon={<Sparkles size={13} color="#3b82f6" />}
                label="Streaming active"
                variant="outlined"
                sx={{ fontSize: '0.75rem', height: 24, borderColor: '#3b82f6', color: '#2563eb' }}
              />
            )}
          </Box>
        </Box>

        {effectiveMessages.length === 0 && !isLoadingHistory && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            This conversation has no messages yet. Send a message to export your chat.
          </Alert>
        )}

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
          Select Export Format:
        </Typography>

        <RadioGroup
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {/* Option A: PDF */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedFormat === 'pdf' ? 'primary.main' : 'divider',
              backgroundColor: selectedFormat === 'pdf' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControlLabel
                value="pdf"
                control={<Radio size="small" />}
                label=""
                sx={{ m: 0 }}
              />
              <FileText size={20} color="#ef4444" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  PDF Document (.pdf) — Recommended
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Multi-page formatted document with page numbers, preserved RGB highlights, and styling.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Option B: HTML */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedFormat === 'html' ? 'primary.main' : 'divider',
              backgroundColor: selectedFormat === 'html' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControlLabel
                value="html"
                control={<Radio size="small" />}
                label=""
                sx={{ m: 0 }}
              />
              <Code size={20} color="#3b82f6" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  HTML Document (.html)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Standalone offline webpage with embedded CSS, Markdown tables, and dark/light themes.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Option C: Markdown */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedFormat === 'md' ? 'primary.main' : 'divider',
              backgroundColor: selectedFormat === 'md' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControlLabel
                value="md"
                control={<Radio size="small" />}
                label=""
                sx={{ m: 0 }}
              />
              <FileText size={20} color="#10a37f" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Markdown (.md)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Clean portable Markdown text with message timestamps, code blocks, and highlight tags.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Option D: Plain Text */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedFormat === 'txt' ? 'primary.main' : 'divider',
              backgroundColor: selectedFormat === 'txt' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControlLabel
                value="txt"
                control={<Radio size="small" />}
                label=""
                sx={{ m: 0 }}
              />
              <AlignLeft size={20} color="#6366f1" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Plain Text (.txt)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Clean, readable text file with preserved layout, dialogue structure, and no markup artifacts.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Option E: Print */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedFormat === 'print' ? 'primary.main' : 'divider',
              backgroundColor: selectedFormat === 'print' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControlLabel
                value="print"
                control={<Radio size="small" />}
                label=""
                sx={{ m: 0 }}
              />
              <Printer size={20} color="#8b5cf6" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Print / Vector PDF via Browser
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Opens browser system print dialog for high-resolution vector PDF printing.
                </Typography>
              </Box>
            </Box>
          </Box>
        </RadioGroup>

        {/* Filename Preview */}
        {selectedFormat !== 'print' && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary', fontSize: '0.75rem' }}>
            File will download as: <strong>{previewFilename}</strong>
          </Typography>
        )}

        {/* Error message */}
        {exportError && (
          <Alert severity="error" sx={{ mt: 2, py: 0.5, borderRadius: 2 }}>
            {exportError}
          </Alert>
        )}

        {/* Success message */}
        {exportSuccess && (
          <Alert
            severity="success"
            icon={<CheckCircle2 size={18} />}
            sx={{ mt: 2, py: 0.5, borderRadius: 2 }}
          >
            {exportSuccess}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isExporting} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={isExporting || isLoadingHistory || effectiveMessages.length === 0}
          startIcon={
            isExporting || isLoadingHistory ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Download size={16} />
            )
          }
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            px: 2.5
          }}
        >
          {isExporting
            ? 'Generating Export...'
            : isLoadingHistory
            ? 'Syncing Data...'
            : selectedFormat === 'print'
            ? 'Open Print Window'
            : 'Download File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
