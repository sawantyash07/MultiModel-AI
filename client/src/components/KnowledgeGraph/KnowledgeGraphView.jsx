import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Drawer,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Grid
} from '@mui/material';
import {
  Search,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Network,
  Share2,
  Layers,
  HelpCircle,
  BarChart3,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  GitMerge,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  FileText,
  Brain,
  X,
  Send,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  List as ListIcon
} from 'lucide-react';
import cytoscape from 'cytoscape';
import { api } from '../../services/api';

// Controlled Color and Shape Mapping
const TYPE_CONFIG = {
  PROJECT: { color: '#3b82f6', shape: 'hexagon', label: 'Project' },
  TECHNOLOGY: { color: '#10b981', shape: 'round-rectangle', label: 'Technology' },
  CONCEPT: { color: '#8b5cf6', shape: 'ellipse', label: 'Concept' },
  DECISION: { color: '#f59e0b', shape: 'diamond', label: 'Decision' },
  TASK: { color: '#f43f5e', shape: 'rectangle', label: 'Task' },
  PREFERENCE: { color: '#a855f7', shape: 'round-diamond', label: 'Preference' },
  PERSON: { color: '#06b6d4', shape: 'ellipse', label: 'Person' },
  ORGANIZATION: { color: '#0ea5e9', shape: 'ellipse', label: 'Organization' },
  DOCUMENT: { color: '#f97316', shape: 'barrel', label: 'Document' },
  CONVERSATION: { color: '#38bdf8', shape: 'ellipse', label: 'Conversation' },
  DEFAULT: { color: '#94a3b8', shape: 'ellipse', label: 'Entity' }
};

export default function KnowledgeGraphView({
  themeMode = 'dark',
  onShowToast,
  onOpenConversation,
  onOpenMemory
}) {
  const isDark = themeMode === 'dark';

  // Graph Data State
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedRelation, setSelectedRelation] = useState('ALL');
  const [layoutName, setLayoutName] = useState('cose');
  const [viewMode, setViewMode] = useState('graph'); // 'graph' or 'table'

  // Selection & Details
  const [selectedElement, setSelectedElement] = useState(null); // { type: 'node' | 'edge', data: ... }
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  // Ask Your Knowledge Drawer
  const [askDrawerOpen, setAskDrawerOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askResponse, setAskResponse] = useState(null);

  // Insights Modal
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);

  // Add / Edit Node Dialog
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [nodeForm, setNodeForm] = useState({ label: '', type: 'CONCEPT', description: '', aliases: '' });

  // Add Edge Dialog
  const [edgeDialogOpen, setEdgeDialogOpen] = useState(false);
  const [edgeForm, setEdgeForm] = useState({ source: '', target: '', relation: 'RELATED_TO', description: '' });

  // Merge Dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Table Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const cyContainerRef = useRef(null);
  const cyRef = useRef(null);

  // Load Graph Data
  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getKnowledgeGraph({
        q: searchQuery,
        type: selectedType,
        source: selectedSource,
        relation: selectedRelation
      });
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setLastSyncTime(data.lastSyncTime || data.updatedAt);
    } catch (err) {
      console.error('Failed to load knowledge graph:', err);
      setError('Failed to load knowledge graph. Please check backend connectivity.');
      onShowToast?.('Failed to load knowledge graph', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, [searchQuery, selectedType, selectedSource, selectedRelation]);

  // Rebuild Graph
  const handleRebuildGraph = async () => {
    setRebuilding(true);
    try {
      const res = await api.rebuildKnowledgeGraph();
      onShowToast?.(`Graph rebuilt: ${res.totalNodes} entities, ${res.totalEdges} relationships`, 'success');
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Failed to rebuild graph: ' + err.message, 'error');
    } finally {
      setRebuilding(false);
    }
  };

  // Cytoscape Elements Definition
  const cyElements = useMemo(() => {
    const cyNodes = nodes.map(n => {
      const conf = TYPE_CONFIG[n.type] || TYPE_CONFIG.DEFAULT;
      return {
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          description: n.description,
          sourcesCount: (n.sources || []).length,
          color: conf.color,
          shape: conf.shape,
          raw: n
        }
      };
    });

    const cyEdges = edges.map(e => ({
      group: 'edges',
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || e.relation,
        relation: e.relation,
        inferred: e.isInferred,
        status: e.status,
        raw: e
      }
    }));

    return [...cyNodes, ...cyEdges];
  }, [nodes, edges]);

  // Initialize and Update Cytoscape
  useEffect(() => {
    if (viewMode !== 'graph' || !cyContainerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements: cyElements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'shape': 'data(shape)',
            'color': isDark ? '#f1f5f9' : '#0f172a',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 34,
            'height': 34,
            'border-width': 2,
            'border-color': isDark ? '#334155' : '#cbd5e1',
            'transition-property': 'background-color, border-color, width, height, opacity',
            'transition-duration': '0.2s',
            'text-background-opacity': isDark ? 0.8 : 0.85,
            'text-background-color': isDark ? '#0f172a' : '#ffffff',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.8,
            'line-color': isDark ? '#475569' : '#94a3b8',
            'target-arrow-color': isDark ? '#475569' : '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.85,
            'line-style': 'solid',
            'opacity': 0.75,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': '0.2s'
          }
        },
        {
          selector: 'edge[?inferred]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3],
            'line-color': isDark ? '#64748b' : '#a1a1aa'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#38bdf8',
            'width': 42,
            'height': 42,
            'z-index': 999
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 3.5,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'opacity': 1,
            'z-index': 999
          }
        },
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'z-index': 90
          }
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.15
          }
        }
      ],
      layout: {
        name: layoutName,
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 6500,
        idealEdgeLength: 85,
        padding: 40
      },
      minZoom: 0.2,
      maxZoom: 3.5,
      wheelSensitivity: 0.25
    });

    // Node Tap Event
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const raw = node.data('raw');
      setSelectedElement({ type: 'node', data: raw });
      setDetailsDrawerOpen(true);

      // Neighborhood highlighting
      cy.elements().removeClass('highlighted dimmed');
      const neighborhood = node.neighborhood().add(node);
      cy.elements().difference(neighborhood).addClass('dimmed');
      neighborhood.addClass('highlighted');
    });

    // Edge Tap Event
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const raw = edge.data('raw');
      setSelectedElement({ type: 'edge', data: raw });
      setDetailsDrawerOpen(true);

      cy.elements().removeClass('highlighted dimmed');
      const edgeWithNodes = edge.connectedNodes().add(edge);
      cy.elements().difference(edgeWithNodes).addClass('dimmed');
      edgeWithNodes.addClass('highlighted');
    });

    // Background Tap Event: Clear selection
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted dimmed');
        setSelectedElement(null);
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [cyElements, viewMode, layoutName, isDark]);

  // Canvas View Controls
  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  };

  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  };

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 40);
  };

  const handleResetLayout = () => {
    if (cyRef.current) {
      cyRef.current.layout({ name: layoutName, animate: true, animationDuration: 400 }).run();
      cyRef.current.elements().removeClass('highlighted dimmed');
      setSelectedElement(null);
    }
  };

  const handleFocusNode = (nodeId) => {
    if (!cyRef.current) return;
    const cyNode = cyRef.current.$id(nodeId);
    if (cyNode.length > 0) {
      cyRef.current.animate({
        center: { eles: cyNode },
        zoom: 1.5,
        duration: 500
      });
      cyNode.emit('tap');
    }
  };

  // Node CRUD Handlers
  const handleOpenAddNode = () => {
    setEditingNode(null);
    setNodeForm({ label: '', type: 'CONCEPT', description: '', aliases: '' });
    setNodeDialogOpen(true);
  };

  const handleOpenEditNode = (node) => {
    setEditingNode(node);
    setNodeForm({
      label: node.label,
      type: node.type,
      description: node.description || '',
      aliases: (node.aliases || []).join(', ')
    });
    setNodeDialogOpen(true);
  };

  const handleSaveNode = async () => {
    if (!nodeForm.label.trim()) return;
    try {
      const aliasList = nodeForm.aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      if (editingNode) {
        await api.updateKnowledgeNode(editingNode.id, {
          label: nodeForm.label.trim(),
          type: nodeForm.type,
          description: nodeForm.description.trim(),
          aliases: aliasList
        });
        onShowToast?.('Node updated successfully', 'success');
      } else {
        await api.createKnowledgeNode({
          label: nodeForm.label.trim(),
          type: nodeForm.type,
          description: nodeForm.description.trim(),
          aliases: aliasList
        });
        onShowToast?.('Node created successfully', 'success');
      }
      setNodeDialogOpen(false);
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Failed to save node: ' + err.message, 'error');
    }
  };

  const handleDeleteNode = async (id) => {
    if (!window.confirm('Are you sure you want to delete this knowledge node and its connected relationships?')) return;
    try {
      await api.deleteKnowledgeNode(id);
      onShowToast?.('Node deleted successfully', 'success');
      setDetailsDrawerOpen(false);
      setSelectedElement(null);
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Failed to delete node: ' + err.message, 'error');
    }
  };

  // Edge CRUD Handlers
  const handleOpenAddEdge = () => {
    setEdgeForm({
      source: selectedElement?.type === 'node' ? selectedElement.data.id : (nodes[0]?.id || ''),
      target: nodes[1]?.id || '',
      relation: 'RELATED_TO',
      description: ''
    });
    setEdgeDialogOpen(true);
  };

  const handleSaveEdge = async () => {
    if (!edgeForm.source || !edgeForm.target) return;
    try {
      await api.createKnowledgeEdge({
        source: edgeForm.source,
        target: edgeForm.target,
        relation: edgeForm.relation,
        description: edgeForm.description.trim()
      });
      onShowToast?.('Relationship created successfully', 'success');
      setEdgeDialogOpen(false);
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Failed to create edge: ' + err.message, 'error');
    }
  };

  const handleDeleteEdge = async (id) => {
    if (!window.confirm('Are you sure you want to delete this relationship?')) return;
    try {
      await api.deleteKnowledgeEdge(id);
      onShowToast?.('Relationship removed', 'success');
      setDetailsDrawerOpen(false);
      setSelectedElement(null);
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Failed to delete relationship: ' + err.message, 'error');
    }
  };

  const handleVerifyEdge = async (id, verified) => {
    try {
      await api.verifyKnowledgeEdge(id, verified);
      onShowToast?.(verified ? 'Relationship confirmed as verified' : 'Relationship rejected', 'success');
      await loadGraphData();
      if (selectedElement?.type === 'edge' && selectedElement.data.id === id) {
        setSelectedElement(prev => ({
          ...prev,
          data: { ...prev.data, status: verified ? 'VERIFIED' : 'REJECTED', isInferred: !verified }
        }));
      }
    } catch (err) {
      onShowToast?.('Verification update failed: ' + err.message, 'error');
    }
  };

  // Merge Handler
  const handleMergeNodes = async () => {
    if (!selectedElement || selectedElement.type !== 'node' || !mergeTargetId) return;
    try {
      await api.mergeKnowledgeNodes(selectedElement.data.id, mergeTargetId);
      onShowToast?.('Nodes merged successfully', 'success');
      setMergeDialogOpen(false);
      setDetailsDrawerOpen(false);
      setSelectedElement(null);
      await loadGraphData();
    } catch (err) {
      onShowToast?.('Merge failed: ' + err.message, 'error');
    }
  };

  // Ask Your Knowledge Handler
  const handleAskKnowledge = async (overridePrompt) => {
    const q = overridePrompt || askQuestion;
    if (!q.trim() || askLoading) return;

    setAskLoading(true);
    setAskResponse(null);
    try {
      const resp = await api.askKnowledgeGraph({
        question: q.trim(),
        focusNodeId: selectedElement?.type === 'node' ? selectedElement.data.id : null
      });
      setAskResponse(resp);
    } catch (err) {
      onShowToast?.('Query failed: ' + err.message, 'error');
    } finally {
      setAskLoading(false);
    }
  };

  // Load Insights
  const handleOpenInsights = async () => {
    setInsightsOpen(true);
    setInsightsLoading(true);
    try {
      const data = await api.getKnowledgeGraphInsights();
      setInsightsData(data);
    } catch (err) {
      onShowToast?.('Failed to load insights: ' + err.message, 'error');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Open Provenance Source Link
  const handleOpenSource = (sourceRef) => {
    if (!sourceRef) return;
    if (sourceRef.sourceType === 'conversation') {
      onOpenConversation?.(sourceRef.sourceId);
    } else if (sourceRef.sourceType === 'memory') {
      onOpenMemory?.();
    } else {
      onShowToast?.(`Document Source: ${sourceRef.sourceTitle || 'Uploaded file'}`, 'info');
    }
  };

  // Counts for Legend
  const typeCounts = useMemo(() => {
    const map = {};
    for (const n of nodes) {
      map[n.type] = (map[n.type] || 0) + 1;
    }
    return map;
  }, [nodes]);

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Controls Toolbar */}
      <Box
        sx={{
          p: 1.5,
          px: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: isDark ? 'background.paper' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          zIndex: 10
        }}
      >
        {/* Title & Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '9px',
              backgroundColor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Network size={20} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Personal Knowledge Graph
              </Typography>
              <Chip
                size="small"
                label={`${nodes.length} nodes · ${edges.length} edges`}
                sx={{
                  height: 20,
                  fontSize: '0.675rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
                  color: isDark ? '#38bdf8' : '#0284c7'
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              Connected knowledge network extracted from conversations, memories & documents
            </Typography>
          </Box>
        </Box>

        {/* Search & Filtering */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search entities, aliases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { height: 34, fontSize: '0.82rem', width: 200 }
            }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{ height: 34, fontSize: '0.8rem' }}
            >
              <MenuItem value="ALL">All Types</MenuItem>
              <MenuItem value="PROJECT">Projects</MenuItem>
              <MenuItem value="TECHNOLOGY">Technologies</MenuItem>
              <MenuItem value="CONCEPT">Concepts</MenuItem>
              <MenuItem value="DECISION">Decisions</MenuItem>
              <MenuItem value="TASK">Tasks</MenuItem>
              <MenuItem value="PREFERENCE">Preferences</MenuItem>
              <MenuItem value="DOCUMENT">Documents</MenuItem>
              <MenuItem value="CONVERSATION">Conversations</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              sx={{ height: 34, fontSize: '0.8rem' }}
            >
              <MenuItem value="ALL">All Sources</MenuItem>
              <MenuItem value="conversation">Conversations</MenuItem>
              <MenuItem value="memory">Memories</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </FormControl>

          {/* View Mode Toggle */}
          <Tooltip title={viewMode === 'graph' ? 'Switch to Table View' : 'Switch to Graph View'}>
            <IconButton
              size="small"
              onClick={() => setViewMode(prev => prev === 'graph' ? 'table' : 'graph')}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                p: 0.8
              }}
            >
              {viewMode === 'graph' ? <ListIcon size={16} /> : <Share2 size={16} />}
            </IconButton>
          </Tooltip>

          {/* Ask Your Knowledge Toggle */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<HelpCircle size={15} color="#8b5cf6" />}
            onClick={() => setAskDrawerOpen(true)}
            sx={{
              height: 34,
              fontSize: '0.8rem',
              fontWeight: 600,
              borderColor: 'rgba(139, 92, 246, 0.4)',
              color: isDark ? '#c084fc' : '#7c3aed',
              backgroundColor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)',
              '&:hover': {
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.15)'
              }
            }}
          >
            Ask Graph
          </Button>

          {/* Insights Button */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<BarChart3 size={15} color="#10b981" />}
            onClick={handleOpenInsights}
            sx={{
              height: 34,
              fontSize: '0.8rem',
              fontWeight: 600,
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: isDark ? '#34d399' : '#059669',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)',
              '&:hover': {
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)'
              }
            }}
          >
            Insights
          </Button>

          {/* Add Entity Button */}
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={15} />}
            onClick={handleOpenAddNode}
            sx={{
              height: 34,
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: 'primary.main',
              color: '#ffffff',
              '&:hover': { backgroundColor: 'primary.dark' }
            }}
          >
            Add Fact
          </Button>

          {/* Rebuild Graph Button */}
          <Tooltip title="Synchronize and extract knowledge from all conversations, memories, and documents">
            <span>
              <IconButton
                size="small"
                disabled={rebuilding}
                onClick={handleRebuildGraph}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  p: 0.8
                }}
              >
                <RefreshCw size={16} className={rebuilding ? 'spin-animation' : ''} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Graph Content Area */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(11, 15, 25, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              zIndex: 20,
              gap: 1.5
            }}
          >
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Loading Personal Knowledge Network...
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2
            }}
          >
            <AlertCircle size={36} color="#f43f5e" />
            <Typography variant="subtitle1" color="error" sx={{ fontWeight: 600 }}>
              {error}
            </Typography>
            <Button variant="outlined" onClick={loadGraphData}>
              Retry Loading
            </Button>
          </Box>
        )}

        {/* View Mode: Graph Canvas */}
        {viewMode === 'graph' && (
          <>
            <Box
              ref={cyContainerRef}
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
                backgroundImage: isDark
                  ? 'radial-gradient(#1e293b 1px, transparent 1px)'
                  : 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Empty Graph State */}
            {!loading && !error && nodes.length === 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  zIndex: 5,
                  pointerEvents: 'none'
                }}
              >
                <Network size={54} color={isDark ? '#475569' : '#94a3b8'} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  No Knowledge Entities Found
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420, textAlign: 'center' }}>
                  Your Knowledge Graph is ready to extract facts from your conversations, persistent memories, and documents.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<RefreshCw size={16} />}
                  onClick={handleRebuildGraph}
                  sx={{ pointerEvents: 'auto', mt: 1 }}
                >
                  Extract Knowledge Now
                </Button>
              </Box>
            )}

            {/* Floating Navigation Controls (Zoom, Pan, Fit, Reset) */}
            <Paper
              elevation={3}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                p: 0.5,
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid',
                borderColor: 'divider',
                zIndex: 10
              }}
            >
              <Tooltip title="Zoom In" placement="left">
                <IconButton size="small" onClick={handleZoomIn}>
                  <ZoomIn size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out" placement="left">
                <IconButton size="small" onClick={handleZoomOut}>
                  <ZoomOut size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit to Screen" placement="left">
                <IconButton size="small" onClick={handleFit}>
                  <Maximize2 size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset View" placement="left">
                <IconButton size="small" onClick={handleResetLayout}>
                  <RotateCcw size={16} />
                </IconButton>
              </Tooltip>
              <Divider sx={{ my: 0.5 }} />
              <Tooltip title="Add Relationship between nodes" placement="left">
                <IconButton size="small" onClick={handleOpenAddEdge}>
                  <Share2 size={16} color="#3b82f6" />
                </IconButton>
              </Tooltip>
            </Paper>

            {/* Bottom Type Legend Bar */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                left: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                p: 0.8,
                px: 1.4,
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid',
                borderColor: 'divider',
                flexWrap: 'wrap',
                zIndex: 10,
                maxWidth: 'calc(100% - 32px)'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                LEGEND:
              </Typography>
              {Object.entries(TYPE_CONFIG)
                .filter(([key]) => key !== 'DEFAULT' && typeCounts[key] > 0)
                .map(([type, cfg]) => (
                  <Box
                    key={type}
                    onClick={() => setSelectedType(prev => prev === type ? 'ALL' : type)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.6,
                      cursor: 'pointer',
                      px: 0.8,
                      py: 0.2,
                      borderRadius: '5px',
                      backgroundColor: selectedType === type ? 'action.selected' : 'transparent',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: cfg.shape === 'hexagon' ? '2px' : '50%',
                        backgroundColor: cfg.color
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      {cfg.label} ({typeCounts[type] || 0})
                    </Typography>
                  </Box>
                ))}
            </Box>
          </>
        )}

        {/* View Mode: List / Table View */}
        {viewMode === 'table' && (
          <Box sx={{ p: 2.5, height: '100%', overflowY: 'auto' }}>
            <Paper elevation={1} sx={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: isDark ? 'background.paper' : '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Canonical Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Aliases</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Sources</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nodes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((node) => {
                      const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.DEFAULT;
                      return (
                        <TableRow
                          key={node.id}
                          hover
                          onClick={() => {
                            setSelectedElement({ type: 'node', data: node });
                            setDetailsDrawerOpen(true);
                          }}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color }} />
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {node.label}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={node.type} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {(node.aliases || []).join(', ') || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                              {node.description || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={`${(node.sources || []).length} refs`} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={node.status || 'ACTIVE'}
                              color={node.status === 'COMPLETED' ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit Node">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenEditNode(node); }}>
                                <Edit2 size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Node">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}>
                                <Trash2 size={14} color="#f43f5e" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 15, 25, 50]}
                component="div"
                count={nodes.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </Paper>
          </Box>
        )}
      </Box>

      {/* Node / Edge Details Drawer */}
      <Drawer
        anchor="right"
        open={detailsDrawerOpen && Boolean(selectedElement)}
        onClose={() => setDetailsDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 380,
            maxWidth: '90vw',
            backgroundColor: 'background.paper',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }
        }}
      >
        {selectedElement?.type === 'node' && (
          <>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Chip
                  size="small"
                  label={selectedElement.data.type}
                  sx={{
                    mb: 0.8,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    backgroundColor: (TYPE_CONFIG[selectedElement.data.type] || TYPE_CONFIG.DEFAULT).color,
                    color: '#ffffff'
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {selectedElement.data.label}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setDetailsDrawerOpen(false)}>
                <X size={18} />
              </IconButton>
            </Box>

            <Divider />

            {/* Description */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Description
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.5, color: 'text.primary' }}>
                {selectedElement.data.description || 'No detailed description available.'}
              </Typography>
            </Box>

            {/* Aliases */}
            {selectedElement.data.aliases && selectedElement.data.aliases.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Known Aliases & Surface Forms
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.6 }}>
                  {selectedElement.data.aliases.map((alias, i) => (
                    <Chip key={i} size="small" label={alias} variant="outlined" sx={{ height: 20, fontSize: '0.675rem' }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Status & Confidence */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  STATUS
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedElement.data.status || 'ACTIVE'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  CONFIDENCE
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>
                  {Math.round((selectedElement.data.confidence || 1.0) * 100)}%
                </Typography>
              </Box>
            </Box>

            <Divider />

            {/* Incident Connections */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Connected Relationships ({edges.filter(e => e.source === selectedElement.data.id || e.target === selectedElement.data.id).length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 1 }}>
                {edges
                  .filter(e => e.source === selectedElement.data.id || e.target === selectedElement.data.id)
                  .map(edge => {
                    const isOutgoing = edge.source === selectedElement.data.id;
                    const neighborId = isOutgoing ? edge.target : edge.source;
                    const neighborNode = nodes.find(n => n.id === neighborId);
                    return (
                      <Paper
                        key={edge.id}
                        variant="outlined"
                        onClick={() => handleFocusNode(neighborId)}
                        sx={{
                          p: 1,
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            label={edge.label || edge.relation}
                            sx={{ height: 18, fontSize: '0.625rem', fontWeight: 600 }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {neighborNode?.label || neighborId}
                          </Typography>
                        </Box>
                        <ArrowRight size={14} color="#94a3b8" />
                      </Paper>
                    );
                  })}
              </Box>
            </Box>

            <Divider />

            {/* Supporting Sources / Provenance */}
            <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Supporting Evidence & Sources ({(selectedElement.data.sources || []).length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {(selectedElement.data.sources || []).map((src, i) => (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{ p: 1.2, borderRadius: '7px', backgroundColor: isDark ? 'background.default' : '#f8fafc' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Chip
                        size="small"
                        icon={src.sourceType === 'conversation' ? <MessageSquare size={12} /> : (src.sourceType === 'memory' ? <Brain size={12} /> : <FileText size={12} />)}
                        label={src.sourceTitle || src.sourceType}
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                      />
                      <Button
                        size="small"
                        variant="text"
                        endIcon={<ExternalLink size={12} />}
                        onClick={() => handleOpenSource(src)}
                        sx={{ fontSize: '0.675rem', p: 0.2 }}
                      >
                        Open Source
                      </Button>
                    </Box>
                    {src.excerpt && (
                      <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', display: 'block' }}>
                        "{src.excerpt}"
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Node Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<Edit2 size={14} />}
                onClick={() => handleOpenEditNode(selectedElement.data)}
              >
                Edit Fact
              </Button>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<GitMerge size={14} />}
                onClick={() => {
                  setMergeTargetId('');
                  setMergeDialogOpen(true);
                }}
              >
                Merge
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleDeleteNode(selectedElement.data.id)}
              >
                <Trash2 size={14} />
              </Button>
            </Box>
          </>
        )}

        {/* Selected Edge Details */}
        {selectedElement?.type === 'edge' && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Relationship Details
              </Typography>
              <IconButton size="small" onClick={() => setDetailsDrawerOpen(false)}>
                <X size={18} />
              </IconButton>
            </Box>

            <Divider />

            <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: 'action.hover' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                RELATIONSHIP TYPE
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {selectedElement.data.relation}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {selectedElement.data.description || 'Direct relationship between entities.'}
              </Typography>
            </Box>

            {/* Connecting Entities */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Connected Entities
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Chip
                  label={nodes.find(n => n.id === selectedElement.data.source)?.label || selectedElement.data.source}
                  onClick={() => handleFocusNode(selectedElement.data.source)}
                  sx={{ fontWeight: 600 }}
                />
                <ArrowRight size={16} />
                <Chip
                  label={nodes.find(n => n.id === selectedElement.data.target)?.label || selectedElement.data.target}
                  onClick={() => handleFocusNode(selectedElement.data.target)}
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            </Box>

            {/* Status & Inferred */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  STATUS
                </Typography>
                <Chip
                  size="small"
                  label={selectedElement.data.status || 'VERIFIED'}
                  color={selectedElement.data.status === 'VERIFIED' ? 'success' : 'warning'}
                  sx={{ mt: 0.5, height: 20, fontSize: '0.675rem', fontWeight: 600 }}
                />
              </Box>
              {selectedElement.data.isInferred && (
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle2 size={13} />}
                    onClick={() => handleVerifyEdge(selectedElement.data.id, true)}
                    sx={{ height: 26, fontSize: '0.7rem' }}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<XCircle size={13} />}
                    onClick={() => handleVerifyEdge(selectedElement.data.id, false)}
                    sx={{ height: 26, fontSize: '0.7rem' }}
                  >
                    Reject
                  </Button>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Supporting Evidence */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Evidence Excerpts ({(selectedElement.data.sources || []).length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {(selectedElement.data.sources || []).map((src, i) => (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{ p: 1.2, borderRadius: '7px', backgroundColor: isDark ? 'background.default' : '#f8fafc' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {src.sourceTitle || src.sourceType}
                      </Typography>
                      <Button size="small" variant="text" onClick={() => handleOpenSource(src)} sx={{ fontSize: '0.65rem' }}>
                        View
                      </Button>
                    </Box>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      "{src.excerpt}"
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>

            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={14} />}
              onClick={() => handleDeleteEdge(selectedElement.data.id)}
            >
              Delete Relationship
            </Button>
          </>
        )}
      </Drawer>

      {/* Ask Your Knowledge Graph Drawer */}
      <Drawer
        anchor="right"
        open={askDrawerOpen}
        onClose={() => setAskDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 440,
            maxWidth: '92vw',
            backgroundColor: 'background.paper',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sparkles size={20} color="#8b5cf6" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ask Your Knowledge
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAskDrawerOpen(false)}>
            <X size={18} />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Ask natural-language questions grounded strictly on your connected knowledge graph and verified sources.
        </Typography>

        <Divider />

        {/* Starter Prompt Chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
          {[
            'What projects have I worked on?',
            'Which projects use React and Spring Boot?',
            'What decisions did I make about my architecture?',
            'Which tasks are still unresolved?'
          ].map((prompt, i) => (
            <Chip
              key={i}
              size="small"
              label={prompt}
              onClick={() => {
                setAskQuestion(prompt);
                handleAskKnowledge(prompt);
              }}
              sx={{
                fontSize: '0.72rem',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'primary.main', color: '#ffffff' }
              }}
            />
          ))}
        </Box>

        {/* Question Input */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask about your projects, tech stack, decisions..."
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAskKnowledge();
            }}
          />
          <Button
            variant="contained"
            disabled={askLoading || !askQuestion.trim()}
            onClick={() => handleAskKnowledge()}
            sx={{ minWidth: 42, px: 1.5 }}
          >
            {askLoading ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
          </Button>
        </Box>

        {/* Answer Output Area */}
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {askLoading && (
            <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={28} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Traversing knowledge graph neighborhoods & fetching evidence...
              </Typography>
            </Box>
          )}

          {askResponse && !askLoading && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '9px',
                backgroundColor: isDark ? 'background.default' : '#f8fafc',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {askResponse.answer}
              </Typography>

              {/* Cited Nodes */}
              {askResponse.citedNodes && askResponse.citedNodes.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.6 }}>
                    CITED KNOWLEDGE NODES:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {askResponse.citedNodes.map(cn => (
                      <Chip
                        key={cn.id}
                        size="small"
                        label={cn.label}
                        onClick={() => handleFocusNode(cn.id)}
                        sx={{
                          cursor: 'pointer',
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
                          color: isDark ? '#38bdf8' : '#0284c7'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Follow-up Suggestions */}
              {askResponse.suggestedQueries && askResponse.suggestedQueries.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.6 }}>
                    FOLLOW-UP EXPLORATIONS:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {askResponse.suggestedQueries.map((sq, i) => (
                      <Button
                        key={i}
                        size="small"
                        variant="text"
                        onClick={() => {
                          setAskQuestion(sq);
                          handleAskKnowledge(sq);
                        }}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '0.75rem', p: 0.4 }}
                      >
                        • {sq}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Drawer>

      {/* Graph Insights Modal */}
      <Dialog
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', backgroundColor: 'background.paper', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart3 size={20} color="#10b981" />
            <span>Graph Analytics & Insights</span>
          </Box>
          <IconButton size="small" onClick={() => setInsightsOpen(false)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {insightsLoading || !insightsData ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Summary Cards */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      TOTAL ENTITIES
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                      {insightsData.totalNodes}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      RELATIONSHIPS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981', mt: 0.5 }}>
                      {insightsData.totalEdges}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      ACTIVE PROJECTS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f59e0b', mt: 0.5 }}>
                      {(insightsData.projectsWithTech || []).length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      PENDING TASKS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f43f5e', mt: 0.5 }}>
                      {(insightsData.unresolvedTasks || []).length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Most Connected Entities (Centrality) */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Most Connected Topics (Degree Centrality)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(insightsData.mostConnectedEntities || []).map((item, idx) => (
                    <Chip
                      key={idx}
                      label={`${item.label} (${item.connectionCount} connections)`}
                      variant="outlined"
                      onClick={() => {
                        setInsightsOpen(false);
                        handleFocusNode(item.id);
                      }}
                      sx={{ fontWeight: 600, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Projects & Technologies */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Projects & Their Tech Stacks
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {(insightsData.projectsWithTech || []).map((p, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: '8px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {p.projectName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.8 }}>
                        {(p.technologies || []).map((t, ti) => (
                          <Chip key={ti} size="small" label={t} sx={{ height: 20, fontSize: '0.675rem' }} />
                        ))}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Box>

              {/* Cross-Source Entities */}
              {insightsData.crossSourceEntities && insightsData.crossSourceEntities.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Cross-Source Entities (Multi-Source Verification)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {insightsData.crossSourceEntities.map((cs, i) => (
                      <Chip
                        key={i}
                        color="secondary"
                        variant="outlined"
                        label={`${cs.label} (${cs.sourceCount} sources)`}
                        onClick={() => {
                          setInsightsOpen(false);
                          handleFocusNode(cs.id);
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Node Dialog */}
      <Dialog
        open={nodeDialogOpen}
        onClose={() => setNodeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingNode ? 'Edit Knowledge Fact' : 'Add New Knowledge Entity'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Canonical Name *"
            fullWidth
            size="small"
            value={nodeForm.label}
            onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
            placeholder="e.g. React, Spring Boot, E-Commerce App"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Category / Type</InputLabel>
            <Select
              label="Category / Type"
              value={nodeForm.type}
              onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
            >
              <MenuItem value="PROJECT">Project</MenuItem>
              <MenuItem value="TECHNOLOGY">Technology</MenuItem>
              <MenuItem value="CONCEPT">Concept</MenuItem>
              <MenuItem value="DECISION">Decision</MenuItem>
              <MenuItem value="TASK">Task</MenuItem>
              <MenuItem value="PREFERENCE">Preference</MenuItem>
              <MenuItem value="PERSON">Person</MenuItem>
              <MenuItem value="ORGANIZATION">Organization</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Aliases (comma-separated)"
            fullWidth
            size="small"
            value={nodeForm.aliases}
            onChange={(e) => setNodeForm({ ...nodeForm, aliases: e.target.value })}
            placeholder="e.g. React.js, ReactJS, UI Library"
          />

          <TextField
            label="Description / Context"
            fullWidth
            multiline
            rows={3}
            size="small"
            value={nodeForm.description}
            onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
            placeholder="Describe what this entity is and how it relates to your work..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNodeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNode} disabled={!nodeForm.label.trim()}>
            Save Fact
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Relationship Dialog */}
      <Dialog
        open={edgeDialogOpen}
        onClose={() => setEdgeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Connect Knowledge Entities</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Source Entity</InputLabel>
            <Select
              label="Source Entity"
              value={edgeForm.source}
              onChange={(e) => setEdgeForm({ ...edgeForm, source: e.target.value })}
            >
              {nodes.map(n => (
                <MenuItem key={n.id} value={n.id}>{n.label} ({n.type})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Relationship Type</InputLabel>
            <Select
              label="Relationship Type"
              value={edgeForm.relation}
              onChange={(e) => setEdgeForm({ ...edgeForm, relation: e.target.value })}
            >
              <MenuItem value="WORKS_ON">WORKS_ON</MenuItem>
              <MenuItem value="USES_TECHNOLOGY">USES_TECHNOLOGY</MenuItem>
              <MenuItem value="RELATED_TO">RELATED_TO</MenuItem>
              <MenuItem value="MENTIONS">MENTIONS</MenuItem>
              <MenuItem value="DECIDED">DECIDED</MenuItem>
              <MenuItem value="DEPENDS_ON">DEPENDS_ON</MenuItem>
              <MenuItem value="HAS_TASK">HAS_TASK</MenuItem>
              <MenuItem value="SUPPORTS">SUPPORTS</MenuItem>
              <MenuItem value="CONTRADICTS">CONTRADICTS</MenuItem>
              <MenuItem value="SUPERSEDES">SUPERSEDES</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Target Entity</InputLabel>
            <Select
              label="Target Entity"
              value={edgeForm.target}
              onChange={(e) => setEdgeForm({ ...edgeForm, target: e.target.value })}
            >
              {nodes.filter(n => n.id !== edgeForm.source).map(n => (
                <MenuItem key={n.id} value={n.id}>{n.label} ({n.type})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Contextual Description"
            fullWidth
            size="small"
            value={edgeForm.description}
            onChange={(e) => setEdgeForm({ ...edgeForm, description: e.target.value })}
            placeholder="e.g. Project core framework integration"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEdgeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdge}
            disabled={!edgeForm.source || !edgeForm.target || edgeForm.source === edgeForm.target}
          >
            Create Connection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge Nodes Dialog */}
      <Dialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Merge Duplicate Entity</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Merge <strong>{selectedElement?.data?.label}</strong> into another target entity.
            All relationships, aliases, and source provenance will be merged safely into the target node.
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>Merge Into (Target Node)</InputLabel>
            <Select
              label="Merge Into (Target Node)"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              {nodes
                .filter(n => selectedElement?.type === 'node' && n.id !== selectedElement.data.id)
                .map(n => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleMergeNodes} disabled={!mergeTargetId}>
            Merge Entities
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
