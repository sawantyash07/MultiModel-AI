import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material';
import {
  Brain,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  ShieldAlert,
  Sparkles,
  Layers,
  FolderGit2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

const CATEGORIES = [
  { value: 'ALL', label: 'All' },
  { value: 'PREFERENCE', label: 'Preferences' },
  { value: 'TECH_STACK', label: 'Tech Stack' },
  { value: 'PROJECT', label: 'Projects' },
  { value: 'DECISION', label: 'Decisions' },
  { value: 'ERROR_SOLUTION', label: 'Errors & Fixes' },
  { value: 'UNRESOLVED_TASK', label: 'Unresolved Tasks' },
  { value: 'REQUIREMENT', label: 'Requirements' },
  { value: 'GENERAL', label: 'General' }
];

const CATEGORY_COLORS = {
  PREFERENCE: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
  TECH_STACK: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  PROJECT: { bg: 'rgba(16, 163, 127, 0.15)', text: '#10a37f', border: 'rgba(16, 163, 127, 0.3)' },
  DECISION: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
  ERROR_SOLUTION: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  UNRESOLVED_TASK: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  GOAL: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  REQUIREMENT: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  GENERAL: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' }
};

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  COMPLETED: { label: 'Completed', bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  RESOLVED: { label: 'Resolved', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  SUPERSEDED: { label: 'Superseded', bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' }
};

export default function MemoryDialog({ open, onClose, onMemoryCountChange }) {
  const [activeTab, setActiveTab] = useState(0); // 0: Memories, 1: Projects
  const [memories, setMemories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // New Memory input
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('PREFERENCE');
  const [newStatus, setNewStatus] = useState('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  useEffect(() => {
    if (open) {
      loadAll();
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [open]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [memData, projData] = await Promise.all([
        api.getMemories().catch(() => ({ memories: [] })),
        api.getProjects().catch(() => ({ projects: [] }))
      ]);
      const list = memData?.memories || [];
      setMemories(list);
      setProjects(projData?.projects || []);
      if (onMemoryCountChange) onMemoryCountChange(list.length);
    } catch (err) {
      console.error('Failed to load memory data:', err);
      setErrorMsg('Failed to fetch data from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemory = async (e) => {
    e?.preventDefault();
    if (!newContent.trim()) return;

    // Client-side quick secret check
    if (/(?:api[_-]?key|password|secret|bearer\s+[a-z0-9_-]+|sk-[a-z0-9]{20,}|ghp_[a-z0-9]{20,})/i.test(newContent)) {
      setErrorMsg('Security Block: API keys, tokens, or passwords cannot be stored in persistent memory.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.addMemory(newContent.trim(), newCategory, newStatus, 3);
      setNewContent('');
      setSuccessMsg('Memory securely saved across all chats!');
      await loadAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add memory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (m) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category || 'GENERAL');
    setEditStatus(m.status || 'ACTIVE');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditCategory('');
    setEditStatus('ACTIVE');
  };

  const handleSaveEdit = async (id) => {
    if (!editContent.trim()) return;
    try {
      await api.updateMemory(id, editContent.trim(), editCategory, editStatus, 3);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update memory.');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    try {
      await api.updateMemoryStatus(id, nextStatus);
      await loadAll();
    } catch (err) {
      setErrorMsg('Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteMemory(id);
      await loadAll();
    } catch (err) {
      setErrorMsg('Failed to delete memory.');
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await api.deleteProject(id);
      await loadAll();
    } catch (err) {
      setErrorMsg('Failed to delete project.');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all persistent memories?')) {
      try {
        await api.clearMemories();
        await loadAll();
        setSuccessMsg('All persistent memories cleared.');
      } catch (err) {
        setErrorMsg('Failed to clear memories.');
      }
    }
  };

  // Filter memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = !search.trim() ||
      m.content?.toLowerCase().includes(search.toLowerCase()) ||
      m.category?.toLowerCase().includes(search.toLowerCase()) ||
      m.status?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || m.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          border: '1px solid',
          borderColor: 'divider',
          maxHeight: '88vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 163, 127, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10a37f'
            }}
          >
            <Brain size={19} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.2 }}>
              Persistent AI Memory & Projects
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cross-chat memory, architectural tracking & continuation context
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2.5 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ minHeight: 40 }}
        >
          <Tab
            label={`Memories (${memories.length})`}
            icon={<Sparkles size={14} />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontSize: '0.825rem', minHeight: 40, py: 0.5 }}
          />
          <Tab
            label={`Tracked Projects (${projects.length})`}
            icon={<FolderGit2 size={14} />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontSize: '0.825rem', minHeight: 40, py: 0.5 }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Alerts */}
        {errorMsg && (
          <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ borderRadius: 2 }}>
            {successMsg}
          </Alert>
        )}

        {activeTab === 0 ? (
          <>
            {/* Add Memory Section */}
            <Box
              component="form"
              onSubmit={handleAddMemory}
              sx={{
                p: 2,
                borderRadius: 2.5,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Plus size={15} color="#10a37f" />
                Add Persistent Memory Item
              </Typography>

              <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={newCategory}
                    label="Category"
                    onChange={(e) => setNewCategory(e.target.value)}
                    sx={{ borderRadius: 2 }}
                  >
                    {CATEGORIES.filter(c => c.value !== 'ALL').map(c => (
                      <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. User preference, tech stack, key architectural choice, or unresolved task"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || !newContent.trim()}
                  startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : <Plus size={16} />}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, whiteSpace: 'nowrap' }}
                >
                  Remember
                </Button>
              </Box>
            </Box>

            {/* Filter and Search Bar */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search memories by keyword, category, status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={15} color="#888" />
                    </InputAdornment>
                  )
                }}
                sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', py: 0.5, maxWidth: '100%' }}>
                {CATEGORIES.map(c => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    size="small"
                    clickable
                    onClick={() => setFilterCategory(c.value)}
                    sx={{
                      borderRadius: 1.5,
                      fontSize: '0.725rem',
                      fontWeight: filterCategory === c.value ? 600 : 400,
                      backgroundColor: filterCategory === c.value ? 'primary.main' : 'background.card',
                      color: filterCategory === c.value ? '#ffffff' : 'text.secondary',
                      border: '1px solid',
                      borderColor: filterCategory === c.value ? 'primary.main' : 'divider'
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Memories List */}
            <Box sx={{ minHeight: 200, maxHeight: 340, overflowY: 'auto', pr: 0.5 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180 }}>
                  <CircularProgress size={26} sx={{ color: '#10a37f' }} />
                </Box>
              ) : filteredMemories.length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                    backgroundColor: 'background.card'
                  }}
                >
                  <Brain size={32} color="#888" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                    {search || filterCategory !== 'ALL'
                      ? 'No memories match your search filter.'
                      : 'No persistent memories saved yet.'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
                    Share your stack, preferences, decisions or tasks in any chat, or add them above!
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {filteredMemories.map(m => {
                    const colorConfig = CATEGORY_COLORS[m.category] || CATEGORY_COLORS.GENERAL;
                    const statusConfig = STATUS_CONFIG[m.status] || STATUS_CONFIG.ACTIVE;
                    const isEditingThis = editingId === m.id;

                    return (
                      <Box
                        key={m.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          backgroundColor: 'background.card',
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.8,
                          transition: 'border-color 0.15s ease',
                          '&:hover': { borderColor: 'rgba(16, 163, 127, 0.4)' }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              size="small"
                              label={m.category || 'GENERAL'}
                              sx={{
                                height: 20,
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                backgroundColor: colorConfig.bg,
                                color: colorConfig.text,
                                border: `1px solid ${colorConfig.border}`
                              }}
                            />
                            <Chip
                              size="small"
                              label={statusConfig.label}
                              clickable={!isEditingThis}
                              onClick={() => !isEditingThis && handleToggleStatus(m.id, m.status)}
                              title="Click to toggle Active / Completed status"
                              sx={{
                                height: 20,
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                backgroundColor: statusConfig.bg,
                                color: statusConfig.text,
                                border: `1px solid ${statusConfig.border}`,
                                cursor: 'pointer'
                              }}
                            />
                            {m.source && (
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.675rem' }}>
                                via {m.source.replace('_', ' ')}
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {isEditingThis ? (
                              <>
                                <Tooltip title="Save">
                                  <IconButton size="small" onClick={() => handleSaveEdit(m.id)} sx={{ color: 'primary.main', p: 0.5 }}>
                                    <Check size={15} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton size="small" onClick={handleCancelEdit} sx={{ color: 'text.disabled', p: 0.5 }}>
                                    <X size={15} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => handleStartEdit(m)} sx={{ color: 'text.secondary', p: 0.5 }}>
                                    <Edit2 size={14} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => handleDelete(m.id)} sx={{ color: 'error.main', p: 0.5 }}>
                                    <Trash2 size={14} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </Box>

                        {isEditingThis ? (
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            <FormControl size="small" sx={{ minWidth: 130 }}>
                              <Select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}
                              >
                                {CATEGORIES.filter(c => c.value !== 'ALL').map(c => (
                                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}
                              >
                                <MenuItem value="ACTIVE">Active</MenuItem>
                                <MenuItem value="COMPLETED">Completed</MenuItem>
                                <MenuItem value="RESOLVED">Resolved</MenuItem>
                                <MenuItem value="SUPERSEDED">Superseded</MenuItem>
                              </Select>
                            </FormControl>
                            <TextField
                              fullWidth
                              size="small"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
                            {m.content}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </>
        ) : (
          /* Projects Tab */
          <Box sx={{ minHeight: 250, maxHeight: 420, overflowY: 'auto' }}>
            {projects.length === 0 ? (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                  backgroundColor: 'background.card'
                }}
              >
                <FolderGit2 size={32} color="#888" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                  No active projects tracked yet.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
                  Mention projects you are building (e.g. "I am building Yash AI...") and Yash AI will automatically track architecture, state, and tasks!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {projects.map(p => (
                  <Box
                    key={p.id}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      backgroundColor: 'background.card',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#10a37f' }}>
                        {p.name}
                      </Typography>
                      <Tooltip title="Delete project context">
                        <IconButton size="small" onClick={() => handleDeleteProject(p.id)} sx={{ color: 'error.main' }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {p.lastKnownState && (
                      <Typography variant="body2" sx={{ fontSize: '0.825rem', color: 'text.primary' }}>
                        <strong>State:</strong> {p.lastKnownState}
                      </Typography>
                    )}

                    {p.techStack && (
                      <Typography variant="body2" sx={{ fontSize: '0.825rem', color: 'text.secondary' }}>
                        <strong>Stack:</strong> {p.techStack}
                      </Typography>
                    )}

                    {p.unresolvedTasks && p.unresolvedTasks.length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AlertCircle size={12} /> Pending Tasks:
                        </Typography>
                        {p.unresolvedTasks.map((task, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', ml: 2, color: 'text.secondary' }}>
                            • {task}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    {p.completedTasks && p.completedTasks.length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircle2 size={12} /> Completed:
                        </Typography>
                        {p.completedTasks.map((task, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', ml: 2, color: 'text.disabled' }}>
                            ✓ {task}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Privacy & Safeguard Info */}
        <Box
          sx={{
            p: 1.2,
            borderRadius: 2,
            backgroundColor: 'rgba(16, 163, 127, 0.05)',
            border: '1px solid rgba(16, 163, 127, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.2
          }}
        >
          <ShieldAlert size={18} color="#10a37f" style={{ flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.725rem', lineHeight: 1.3 }}>
            <strong>Privacy & Security Guarantee:</strong> Yash AI automatically filters out passwords, tokens, and API keys. Memories and projects are stored locally on your machine and relevant items are seamlessly retrieved to personalize responses.
          </Typography>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Button
          color="error"
          size="small"
          onClick={handleClearAll}
          disabled={memories.length === 0}
          startIcon={<Trash2 size={14} />}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Clear All Memories
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={onClose}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
