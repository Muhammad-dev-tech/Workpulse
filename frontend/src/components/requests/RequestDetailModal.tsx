import React, { useState } from 'react';
import { RequestItem, UserPersona, Department } from '../../types';
import { api } from '../../services/api';
import { AssignTaskModal } from '../tasks/AssignTaskModal';
import {
  X,
  Clock,
  User,
  Building,
  CheckCircle,
  XCircle,
  MessageSquare,
  History,
  Hourglass,
  Send,
  GitCommit,
  Check,
  AlertCircle,
  CheckSquare,
  Plus,
  Play,
  Paperclip,
  Download,
  FileText,
  Upload
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

  const handleAttachPresetDoc = async (docName: string, docType: string) => {
    if (!request) return;
    try {
      setIsUploadingFile(true);
      await api.addAttachment(request.id, {
        fileName: docName,
        fileSize: Math.floor(Math.random() * 250000) + 50000,
        fileType: docType,
        fileUrl: '#'
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to attach document');
    } finally {
      setIsUploadingFile(false);
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
  const canManage = isManagerOfDept || isAdmin;
  const canApprove = currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ORG_ADMIN' || (currentUser.role === 'MANAGER' && currentUser.departmentId === request.departmentId));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
        <div className="glass-dropdown relative flex flex-col h-[90vh] w-full max-w-4xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                {request.requestId}
              </span>
              <div>
                <h2 className="text-base font-bold text-white line-clamp-1">{request.title}</h2>
                <span className="text-xs text-slate-400">Created {new Date(request.createdAt).toLocaleDateString()} by {request.requesterName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canManage && request.status !== 'COMPLETED' && (
                <button
                  onClick={handleCompleteRequest}
                  disabled={isCompleting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{isCompleting ? 'Completing...' : 'Verify & Close Request'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body with 2-Column Layout */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left / Main Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Requisition Description</h4>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{request.description}</p>
              </div>

              {/* Waiting On Bottleneck Notice (if applicable) */}
              {request.waitingOn && (
                <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                      <Hourglass className="h-4 w-4" />
                      <span>Current Blocker: Waiting On</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Since {request.waitingSince ? new Date(request.waitingSince).toLocaleDateString() : 'recent'}
                    </span>
                  </div>
                  <div className="text-base font-extrabold text-amber-200">
                    {request.waitingOn}
                  </div>
                  <p className="text-xs text-slate-300">
                    Work on {request.requestId} is suspended until the required dependency or quotation is provided.
                  </p>
                </div>
              )}

              {/* Operational Tasks Section (Section 9, 15, 33) */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-indigo-400" />
                    <span>Operational Resolution Tasks ({(request.tasks || []).length})</span>
                  </h4>

                  {canManage && request.status !== 'COMPLETED' && (
                    <button
                      onClick={() => setAssignTaskOpen(true)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600/30 border border-indigo-500/40 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/50 transition"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Assign Task</span>
                    </button>
                  )}
                </div>

                {(!request.tasks || request.tasks.length === 0) ? (
                  <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                    No individual tasks dispatched yet.
                    {canManage && (
                      <span className="block mt-1 text-indigo-400">
                        Click "Assign Task" above to assign diagnostic or installation steps to a technician.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {request.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-400">{task.taskId}</span>
                            <span className="text-xs font-semibold text-white">{task.title}</span>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            task.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            task.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse' :
                            'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Assignee: <strong className="text-slate-200">{task.assigneeName}</strong></span>
                          <span>Type: <strong className="text-slate-200">{task.taskType}</strong></span>
                        </div>

                        {task.resultNotes && (
                          <div className="rounded-lg bg-slate-900 p-2 text-[11px] text-emerald-300 border border-slate-800">
                            <strong>Resolution:</strong> {task.resultNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approvals Section */}
              {request.approvals && request.approvals.length > 0 && (
                <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-400" />
                    <span>Required Governance & Approvals</span>
                  </h4>

                  <div className="space-y-3">
                    {request.approvals.map((app) => (
                      <div key={app.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{app.approverName}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              app.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              app.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                              'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}>
                              {app.status}
                            </span>
                          </div>
                          {app.notes && <p className="text-xs text-slate-400 mt-1">Note: {app.notes}</p>}
                        </div>

                        {app.status === 'PENDING' && canApprove && (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={isDeciding}
                              onClick={() => handleDecision(app.id, 'APPROVED')}
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              disabled={isDeciding}
                              onClick={() => handleDecision(app.id, 'REJECTED')}
                              className="flex items-center gap-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Timeline */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <History className="h-4 w-4 text-cyan-400" />
                  <span>Operational Timeline & Audit Trail</span>
                </h4>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {request.timeline.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-3">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-[#0b0f19] bg-indigo-500"></span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{event.title}</span>
                          <span className="text-[10px] text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                        {event.details && <p className="text-xs text-slate-400 mt-0.5">{event.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="space-y-6">
              {/* Metadata Card */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-400">Request Attributes</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Department</span>
                    <span className="font-semibold text-white">{request.departmentName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Request Type</span>
                    <span className="font-semibold text-purple-300">{request.requestTypeName || 'General'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Status</span>
                    <span className="font-semibold text-cyan-300">{request.status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Priority</span>
                    <span className="font-semibold text-white">{request.priority}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Current Stage</span>
                    <span className="font-semibold text-indigo-300">{request.currentStepName || 'Active Queue'}</span>
                  </div>
                  {request.dueDate && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Target Due Date</span>
                      <span className="font-semibold text-white">{new Date(request.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments & Documentation Section */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4 text-indigo-400" />
                    <span>Documentation & Proofs ({(request.attachments || []).length})</span>
                  </h4>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg transition"
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
                  <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center space-y-2">
                    <span className="text-xs text-slate-500 block">No verification files or proofs attached.</span>
                    <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                      <button
                        onClick={() => handleAttachPresetDoc('Level_300_Exam_Slip.pdf', 'application/pdf')}
                        className="text-[10px] bg-slate-900 border border-slate-700/80 hover:border-indigo-500/50 text-slate-300 hover:text-white px-2 py-1 rounded-lg transition"
                      >
                        + Attach Exam Slip Proof
                      </button>
                      <button
                        onClick={() => handleAttachPresetDoc('VC_Approval_Letter.pdf', 'application/pdf')}
                        className="text-[10px] bg-slate-900 border border-slate-700/80 hover:border-indigo-500/50 text-slate-300 hover:text-white px-2 py-1 rounded-lg transition"
                      >
                        + Attach VC Approval Letter
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {request.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-white truncate block text-[11px]">{att.fileName}</span>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(att.fileSize / 1024)} KB · by {att.uploadedByName}
                            </span>
                          </div>
                        </div>

                        {att.fileUrl && att.fileUrl !== '#' ? (
                          <a
                            href={att.fileUrl}
                            download={att.fileName}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0 ml-2"
                            title="Download / View"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            Verified
                          </span>
                        )}
                      </div>
                    ))}

                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        + Add another document
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments Feed */}
              <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col h-80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <span>Internal Comments ({request.comments.length})</span>
                </h4>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {request.comments.length === 0 ? (
                    <span className="text-slate-500 italic text-center block pt-8">No comments yet.</span>
                  ) : (
                    request.comments.map((c) => (
                      <div key={c.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-[11px]">{c.authorName}</span>
                          <span className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-300 leading-normal">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add operational update or note..."
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="rounded-xl bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    <Send className="h-4 w-4" />
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
          onClose={() => setAssignTaskOpen(false)}
          onAssigned={onRefresh}
        />
      )}
    </>
  );
};
