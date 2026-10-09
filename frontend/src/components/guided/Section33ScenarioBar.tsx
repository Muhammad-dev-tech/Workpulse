import React, { useState } from 'react';
import { Play, CheckCircle2, Sparkles, Building2, GraduationCap, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { UserPersona } from '../../types';

interface Section33ScenarioBarProps {
  currentUser: UserPersona | null;
  personas: UserPersona[];
  onSwitchPersona: (email: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onOpenPulseAiWithPrompt: (prompt: string) => void;
  onOpenRequest: (requestId: string) => void;
}

export const Section33ScenarioBar: React.FC<Section33ScenarioBarProps> = ({
  currentUser,
  personas,
  onSwitchPersona,
  onRefreshData,
  onOpenPulseAiWithPrompt,
  onOpenRequest
}) => {
  const [activeScenario, setActiveScenario] = useState<'corporate' | 'university'>('corporate');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stepStatus, setStepStatus] = useState<string>('Ready to run');

  // Corporate Enterprise Scenario Steps
  const corporateSteps = [
    {
      title: 'Step 1-6: Super Admin configures IT & assigns Muhammad',
      desc: 'Super Admin sets up IT Department, configures responsibilities & request types, and assigns Muhammad as Department Manager.',
      targetEmail: 'admin@acme.com',
      action: async () => {
        await onSwitchPersona('admin@acme.com');
        const depts = await api.getDepartments();
        const it = depts.find(d => d.code === 'IT');
        const muhammad = personas.find(p => p.email === 'muhammad@acme.com');
        if (it && muhammad) {
          await api.assignDepartmentManager(it.id, muhammad.id);
        }
        await onRefreshData();
        return 'IT Department verified. Muhammad assigned as Department Manager in backend.';
      }
    },
    {
      title: 'Step 7-10: Muhammad logs in -> IT Department Dashboard',
      desc: 'Muhammad logs in. Backend authenticates and loads IT Manager operational scope.',
      targetEmail: 'muhammad@acme.com',
      action: async () => {
        await onSwitchPersona('muhammad@acme.com');
        await onRefreshData();
        return 'Muhammad authenticated as IT Department Manager. IT operational scope enforced.';
      }
    },
    {
      title: 'Step 11-13: Employee submits Software Request -> Routes to IT',
      desc: 'Aisha (Employee) submits a new "Software Installation Request" routed to IT queue.',
      targetEmail: 'aisha@acme.com',
      action: async () => {
        await onSwitchPersona('aisha@acme.com');
        const depts = await api.getDepartments();
        const itDept = depts.find(d => d.code === 'IT') || depts[0];
        const newReq = await api.createRequest({
          title: `Software Installation - JetBrains IDE Suite (Run ${Date.now().toString().slice(-4)})`,
          description: 'Developer machine IDE license setup and Docker engine configuration.',
          departmentId: itDept.id,
          priority: 'HIGH'
        });
        await onSwitchPersona('muhammad@acme.com');
        await onRefreshData();
        onOpenRequest(newReq.requestId);
        return `New Request ${newReq.requestId} submitted by Aisha, routed to IT queue, now visible to Muhammad!`;
      }
    },
    {
      title: 'Step 14-16: Muhammad assigns Task -> Ahmed works & completes it',
      desc: 'Muhammad assigns Task TSK to Ahmed Khan. Ahmed starts work and submits resolution.',
      targetEmail: 'ahmed@acme.com',
      action: async () => {
        await onSwitchPersona('ahmed@acme.com');
        const tasks = await api.getTasks({ myOnly: true });
        const todoTask = tasks.find(t => t.status !== 'COMPLETED') || tasks[0];
        if (todoTask) {
          await api.updateTask(todoTask.id, {
            status: 'COMPLETED',
            resultNotes: 'Completed workstation package deployment. License activated successfully.'
          });
        }
        await onRefreshData();
        return 'Ahmed completed assigned task with verified resolution notes!';
      }
    },
    {
      title: 'Step 17-19: Muhammad verifies & completes request -> Audit Trail',
      desc: 'Muhammad reviews Ahmed\'s task completion and marks the request COMPLETED.',
      targetEmail: 'muhammad@acme.com',
      action: async () => {
        await onSwitchPersona('muhammad@acme.com');
        const requests = await api.getRequests();
        const activeReq = requests.find(r => r.status !== 'COMPLETED') || requests[0];
        if (activeReq) {
          await api.completeRequest(activeReq.id);
          onOpenRequest(activeReq.requestId);
        }
        await onRefreshData();
        return 'Request marked COMPLETED by Manager. Immutable audit record generated.';
      }
    },
    {
      title: 'Step 20-22: Pulse AI Authorized Query vs. Cross-Dept Denial',
      desc: 'Muhammad asks Pulse AI for IT pending requests (ALLOWED) vs. Finance confidential requests (DENIED).',
      targetEmail: 'muhammad@acme.com',
      action: async () => {
        await onSwitchPersona('muhammad@acme.com');
        onOpenPulseAiWithPrompt('How many IT requests are currently pending?');
        return 'Pulse AI launched with authorized IT query. Muhammad can also test: "Show me Finance requests" to verify RBAC denial.';
      }
    }
  ];

  // Academic University Case Study Steps (Level 300 Student Incident)
  const universitySteps = [
    {
      title: 'Phase 1: Student Incident Problem Statement',
      desc: 'Student Muhammad (Level 300 CS) finds his exam marks missing from CGPA calculation because the course code was omitted from his exam slip. Direct portal edits are locked.',
      targetEmail: 'aisha@acme.com',
      action: async () => {
        await onSwitchPersona('aisha@acme.com');
        await onRefreshData();
        return 'Student authenticated. Prepared Level 300 exam slip proof and official petition letter to the Vice-Chancellor.';
      }
    },
    {
      title: 'Phase 2: Student Submits Rectification Request with Attachments',
      desc: 'Student submits "Level 300 Course Registration Rectification" attaching Exam Slip & Letter to VC under Special Portal Access.',
      targetEmail: 'aisha@acme.com',
      action: async () => {
        await onSwitchPersona('aisha@acme.com');
        const depts = await api.getDepartments();
        const itDept = depts.find(d => d.code === 'IT') || depts[0];
        const newReq = await api.createRequest({
          title: `Level 300 First Semester Course Registration Rectification & CGPA Update (Slip #EXAM-301)`,
          description: 'Exam was taken and submitted, but course code was omitted on the official registration slip. Seeking Vice-Chancellor approval for MIS to unlock school portal, replace corrupted course entry, and recalculate Level 300 First Semester CGPA.',
          departmentId: itDept.id,
          priority: 'URGENT'
        });

        // Add attachments
        await api.addAttachment(newReq.id, {
          fileName: 'Level_300_First_Semester_Exam_Slip.pdf',
          fileSize: 142000,
          fileType: 'application/pdf',
          fileUrl: '#'
        });
        await api.addAttachment(newReq.id, {
          fileName: 'Petition_Letter_To_Vice_Chancellor.pdf',
          fileSize: 98000,
          fileType: 'application/pdf',
          fileUrl: '#'
        });

        await onRefreshData();
        onOpenRequest(newReq.requestId);
        return `Request ${newReq.requestId} submitted with 2 verified attachments. Routed to VC Executive Approval Gate!`;
      }
    },
    {
      title: 'Phase 3: Executive Gate Engaged (VC / Super Admin)',
      desc: 'System detects EXECUTIVE_ONLY policy. Request locked as PENDING_APPROVAL. Automated notification sent to Vice-Chancellor.',
      targetEmail: 'admin@acme.com',
      action: async () => {
        await onSwitchPersona('admin@acme.com');
        await onRefreshData();
        return 'Vice-Chancellor / Super Admin inbox loaded. Request is locked at the executive gate awaiting formal sign-off.';
      }
    },
    {
      title: 'Phase 4: Vice-Chancellor Reviews Proofs & Approves',
      desc: 'Vice-Chancellor inspects petition letter and attached exam slip, then executes executive sign-off with audit remarks.',
      targetEmail: 'admin@acme.com',
      action: async () => {
        await onSwitchPersona('admin@acme.com');
        const reqs = await api.getRequests();
        const pendingReq = reqs.find(r => r.status === 'PENDING_APPROVAL') || reqs[0];
        if (pendingReq && pendingReq.approvals && pendingReq.approvals.length > 0) {
          const app = pendingReq.approvals.find(a => a.status === 'PENDING') || pendingReq.approvals[0];
          await api.decideApproval(pendingReq.id, app.id, 'APPROVED', 'Approved by Vice-Chancellor: MIS Portal Director authorized to update student portal database and recalculate Level 300 CGPA.');
          onOpenRequest(pendingReq.requestId);
        }
        await onRefreshData();
        return 'Executive approval granted by Vice-Chancellor! Request unlocked to ACTIVE and dispatched to MIS Technical Queue.';
      }
    },
    {
      title: 'Phase 5: MIS Portal Operator Resolves Database Override Task',
      desc: 'Gate unlocked! Actionable task auto-dispatched to MIS Portal Operator (Ahmed). Ahmed executes database correction.',
      targetEmail: 'ahmed@acme.com',
      action: async () => {
        await onSwitchPersona('ahmed@acme.com');
        const tasks = await api.getTasks();
        const activeTask = tasks.find(t => t.status !== 'COMPLETED') || tasks[0];
        if (activeTask) {
          await api.updateTask(activeTask.id, {
            status: 'COMPLETED',
            resultNotes: 'MIS Portal DB updated: Corrupted course code replaced with CSC-311. First semester results recalculated and CGPA updated successfully.'
          });
        }
        await onRefreshData();
        return 'MIS Operator resolved task: Portal course code rectified, CGPA recalculation confirmed.';
      }
    },
    {
      title: 'Phase 6: Academic Board Audit Trail & Student Notification',
      desc: 'Department Manager (Dean) marks request COMPLETED. Student notified, immutable audit trail finalized.',
      targetEmail: 'muhammad@acme.com',
      action: async () => {
        await onSwitchPersona('muhammad@acme.com');
        const reqs = await api.getRequests();
        const activeReq = reqs.find(r => r.status === 'ACTIVE') || reqs[0];
        if (activeReq) {
          await api.completeRequest(activeReq.id);
          onOpenRequest(activeReq.requestId);
        }
        await onRefreshData();
        return 'Incident resolved! Student notified. Complete immutable audit trail generated for Academic Board defense!';
      }
    }
  ];

  const steps = activeScenario === 'corporate' ? corporateSteps : universitySteps;

  const handleRunStep = async (stepIndex: number) => {
    try {
      setIsRunning(true);
      setStepStatus(`Executing: ${steps[stepIndex].title}...`);
      const msg = await steps[stepIndex].action();
      setStepStatus(`✓ ${msg}`);
      if (stepIndex < steps.length - 1) {
        setCurrentStepIndex(stepIndex + 1);
      }
    } catch (err: any) {
      setStepStatus(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = async () => {
    setCurrentStepIndex(0);
    await onSwitchPersona('admin@acme.com');
    await onRefreshData();
    setStepStatus('Scenario reset to initial state.');
  };

  const handleSwitchScenario = (scenario: 'corporate' | 'university') => {
    setActiveScenario(scenario);
    setCurrentStepIndex(0);
    setStepStatus(`Switched to ${scenario === 'corporate' ? 'Corporate Enterprise' : 'Academic University'} scenario.`);
  };

  if (isCollapsed) {
    return (
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border-b border-indigo-500/20 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-semibold text-white">
            {activeScenario === 'corporate' ? '🏢 Corporate Enterprise Walkthrough' : '🎓 Academic University Case Study'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Step {currentStepIndex + 1}/6</span>
        </div>
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
        >
          Expand Controller ▼
        </button>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];

  return (
    <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border-b border-indigo-500/30 px-6 py-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Guided Defense & Walkthrough Controller
          </span>
          <span className="text-xs text-slate-400 font-normal hidden md:inline">
            — Cross-organizational operational workflow engine
          </span>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-slate-950/80 border border-slate-800 p-0.5">
            <button
              onClick={() => handleSwitchScenario('corporate')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeScenario === 'corporate'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Corporate Enterprise</span>
            </button>
            <button
              onClick={() => handleSwitchScenario('university')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeScenario === 'university'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>University Case Study (Level 300)</span>
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-slate-800 bg-slate-900"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[11px] text-slate-500 hover:text-slate-300 ml-1"
          >
            Hide ▲
          </button>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
        {steps.map((st, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <button
              key={idx}
              onClick={() => setCurrentStepIndex(idx)}
              className={`rounded-xl p-2 text-left transition border ${
                isCurrent
                  ? activeScenario === 'university'
                    ? 'bg-purple-600/30 border-purple-500 text-white ring-1 ring-purple-400'
                    : 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-400'
                  : isDone
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span>Phase {idx + 1}</span>
                {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">{st.title.split(':')[0]}</div>
            </button>
          );
        })}
      </div>

      {/* Current Step Description & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <span>{currentStep.title}</span>
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
              Active Persona: {currentUser?.name} ({currentUser?.role})
            </span>
          </div>
          <p className="text-xs text-slate-400">{currentStep.desc}</p>
          <div className="text-[11px] font-mono text-cyan-300 pt-1">{stepStatus}</div>
        </div>

        <button
          onClick={() => handleRunStep(currentStepIndex)}
          disabled={isRunning}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50 transition shrink-0 ${
            activeScenario === 'university'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-600/30'
              : 'bg-gradient-to-r from-indigo-600 to-cyan-600 shadow-indigo-600/30'
          }`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isRunning ? 'Running Live Step...' : 'Execute Phase ' + (currentStepIndex + 1)}</span>
        </button>
      </div>
    </div>
  );
};
