import React, { useState } from 'react';
import { RequestItem, UserPersona, Department } from '../../types';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';
import { AssignTaskModal } from '../tasks/AssignTaskModal';
import {
  X,
  Clock,
  User,
  Building2,
  CheckCircle,
  MessageSquare,
  History,
  Hourglass,
  Send,
  Check,
  CheckSquare,
  Plus,
  Paperclip,
  Download,
  FileText,
  Upload,
  ShieldCheck
} from 'lucide-react';

interface RequestDetailModalProps {
  request: RequestItem | null;
  currentUser: UserPersona | null;
  personas?: UserPersona[];
  departments?: Department[];
  onClose: () => void;
  onRefresh: () => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  currentUser,
  personas = [],
  departments = [],
  onClose,
  onRefresh
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFile(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const fileUrl = (reader.result as string) || '';
        await api.addAttachment(request!.id, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          fileUrl
        });
        onRefresh();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setIsUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  if (!request) return null;

  const currentDept = departments.find(d => d.id === request.departmentId);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await api.addComment(request.id, commentText);
      setCommentText('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDecision = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      setIsDeciding(true);
      await api.decideApproval(request.id, approvalId, decision, approvalNotes);
      setApprovalNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeciding(false);
    }
  };

  const handleCompleteRequest = async () => {
    try {
      setIsCompleting(true);
      await api.completeRequest(request.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to complete request');
    } finally {
      setIsCompleting(false);
    }
  };

  const isManagerOfDept = currentUser?.role === 'MANAGER' && currentUser?.departmentId === request.departmentId;
  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN';
  const isDean = currentUser?.role === 'DEAN';
  const canManage = isManagerOfDept || isAdmin;

  const canApproveItem = (approval: any) => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (approval.approverId === currentUser.id) return true;
    const step = (approval.stepId || approval.id || '').toLowerCase();
    if (step.includes('tier-1') || step.includes('dept-manager') || step.includes('manager')) {
      return currentUser.role === 'MANAGER' && (!currentUser.departmentId || currentUser.departmentId === request.departmentId);
    }
    if (step.includes('tier-2') || step.includes('dean')) {
      return currentUser.role === 'DEAN' || currentUser.role === 'ORG_ADMIN' || currentUser.role === 'SUPER_ADMIN';
    }
    if (step.includes('tier-3') || step.includes('super-admin') || step.includes('exec')) {
      return isAdmin;
    }
    return isManagerOfDept || isDean || isAdmin;
  };

  const pendingApprovalForUser = request.approvals?.find(a => a.status === 'PENDING' && canApproveItem(a));
  const activePendingApproval = request.approvals?.find(a => a.status === 'PENDING');

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
        <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                {request.requestId}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{request.title}</h2>
                <span className="text-[11px] text-slate-500 truncate block">
                  Created {new Date(request.createdAt).toLocaleDateString()} by {request.requesterName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              {pendingApprovalForUser && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDecision(pendingApprovalForUser.id, 'APPROVED')}
                    disabled={isDeciding}
                    className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isDeciding ? 'Saving...' : 'Approve'}</span>
                  </button>
                  <button
                    onClick={() => handleDecision(pendingApprovalForUser.id, 'REJECTED')}
                    disabled={isDeciding}
                    className="flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              )}

              {canManage && request.status !== 'COMPLETED' && request.status !== 'PENDING_APPROVAL' && (
                <button
                  onClick={handleCompleteRequest}
                  disabled={isCompleting}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{isCompleting ? 'Closing...' : 'Close Request'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: 2 Columns */}
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Main Section (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Approval Notice */}
              {request.status === 'PENDING_APPROVAL' && (
                <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Approval Required: {request.currentStepName || 'Pending'}</span>
                    </span>
                  </div>

                  {pendingApprovalForUser ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-purple-900 dark:text-purple-200">
                        Your authorization as {currentUser?.role ? (terms.roles[currentUser.role] || currentUser.role) : 'Authorized Official'} is required to proceed.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="Optional notes or remarks..."
                          className="flex-1 rounded-md border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                        />
                        <button
                          onClick={() => handleDecision(pendingApprovalForUser.id, 'APPROVED')}
                          disabled={isDeciding}
                          className="rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(pendingApprovalForUser.id, 'REJECTED')}
                          disabled={isDeciding}
                          className="rounded-md bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : activePendingApproval ? (
                    <p className="text-xs text-purple-900 dark:text-purple-200">
                      Awaiting sign-off by <strong>{activePendingApproval.approverName}</strong>.
                    </p>
                  ) : null}
                </div>
              )}

              {/* Description */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              {/* Blocker Alert */}
              {request.waitingOn && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Hourglass className="h-3.5 w-3.5" />
                      <span>Current Blocker</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Since {request.waitingSince ? new Date(request.waitingSince).toLocaleDateString() : 'recent'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-amber-950 dark:text-amber-100">
                    Waiting on: {request.waitingOn}
                  </div>
                </div>
              )}

              {/* Operational Tasks Section */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Tasks ({(request.tasks || []).length})</span>
                  </span>

                  {canManage && request.status !== 'COMPLETED' && (
                    <button
                      onClick={() => setAssignTaskOpen(true)}
                      className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Assign Task</span>
                    </button>
                  )}
                </div>

                {(!request.tasks || request.tasks.length === 0) ? (
                  <p className="text-xs text-slate-400 py-2">No individual tasks assigned.</p>
                ) : (
                  <div className="space-y-1.5">
                    {request.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-md border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2.5 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="font-mono text-[11px] text-slate-500">{task.taskId}</span>
                            <span className="text-slate-900 dark:text-white">{task.title}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Assignee: {task.assigneeName}</span>
                          <span>{task.taskType}</span>
                        </div>
                        {task.resultNotes && (
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-1.5 rounded">
                            {task.resultNotes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-slate-400" />
                  <span>Timeline</span>
                </span>

                <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                  {request.timeline.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-2.5 text-xs">
                      <span className="absolute -left-5 top-1 h-2 w-2 rounded-full bg-emerald-600"></span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white text-[11px]">{event.title}</span>
                          <span className="text-[10px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {event.details && <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">{event.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (1 col) */}
            <div className="space-y-4">
              {/* Attributes Card */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Attributes</span>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Department</span>
                    <span className="font-medium text-slate-900 dark:text-white">{request.departmentName}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium text-slate-900 dark:text-white">{request.requestTypeName || 'General'}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Status</span>
                    <span className="font-medium text-slate-900 dark:text-white">{request.status}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Priority</span>
                    <span className="font-medium text-slate-900 dark:text-white">{request.priority}</span>
                  </div>
                  {request.dueDate && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">Due Date</span>
                      <span className="font-medium text-slate-900 dark:text-white">{new Date(request.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Documents ({(request.attachments || []).length})</span>
                  </span>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {(!request.attachments || request.attachments.length === 0) ? (
                  <p className="text-xs text-slate-400">No documents attached.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {request.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-[11px] font-medium text-slate-900 dark:text-slate-200">{att.fileName}</span>
                        </div>
                        {att.fileUrl && att.fileUrl !== '#' && (
                          <a
                            href={att.fileUrl}
                            download={att.fileName}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-2 shrink-0"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Feed */}
              <div className="rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col h-72">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                  <span>Comments ({request.comments.length})</span>
                </span>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                  {request.comments.length === 0 ? (
                    <p className="text-slate-400 text-center pt-8">No comments yet</p>
                  ) : (
                    request.comments.map((c) => (
                      <div key={c.id} className="rounded border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <strong className="text-slate-900 dark:text-slate-200 font-semibold">{c.authorName}</strong>
                          <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-normal">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="mt-2 flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add an internal note..."
                    className="flex-1 rounded-md border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="rounded-md bg-emerald-600 hover:bg-emerald-700 p-1.5 text-white disabled:opacity-50 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {assignTaskOpen && (
        <AssignTaskModal
          request={request}
          department={currentDept}
          personas={personas}
          currentUser={currentUser}
          onClose={() => setAssignTaskOpen(false)}
          onAssigned={onRefresh}
        />
      )}
    </>
  );
};
