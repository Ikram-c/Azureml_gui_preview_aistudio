import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Database,
  Cpu,
  Activity,
  GitBranch,
  Key,
  LogOut,
  RefreshCw,
  FolderPlus,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  Terminal,
  ExternalLink,
  Search,
  Folder,
  HelpCircle,
  Server,
  Box,
  Smartphone,
  Monitor,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatBytes, matchesWildcard, filterRepositories } from './utils/cloudUtils';

interface BlobItem {
  name: string;
  size: number;
  type: string;
  updated: string;
  content: string;
}

interface ComputeTarget {
  name: string;
  type: string;
  state: string;
  location: string;
  vmSize: string;
  nodes: string;
}

interface RegisteredModel {
  name: string;
  version: string;
  createdAt: string;
  framework: string;
  stage: string;
}

interface MLJob {
  name: string;
  displayName: string;
  status: string;
  compute: string;
  experiment: string;
  command: string;
  environment: string;
  createdAt: string;
  outputs: string[];
  logs: string;
}

interface GitHubRepo {
  name: string;
  nameWithOwner: string;
  visibility: string;
  clone_url: string;
  html_url: string;
  description: string;
  language: string;
  stars?: number;
  updated_at: string;
  cloned?: boolean;
}

interface AppState {
  azure: {
    authenticated: boolean;
    authMode: 'browser' | 'key' | null;
    tenantId: string;
    accountName: string;
    containerName: string;
    connectedWorkspace: string;
    subscriptions: { id: string; name: string }[];
    resourceGroups: Record<string, string[]>;
    storageAccounts: { name: string; resource_group: string; subscription_id: string }[];
    containers: Record<string, string[]>;
    workspaces: Record<string, { name: string; id: string }[]>;
  };
  blobs: Record<string, BlobItem[]>;
  ml: {
    computes: ComputeTarget[];
    models: RegisteredModel[];
    jobs: MLJob[];
  };
  github: {
    authenticated: boolean;
    user: string | null;
    repos: GitHubRepo[];
  };
}

type ViewTab = 'connect' | 'storage' | 'ml' | 'monitor' | 'github';

const NAV_ITEMS: { id: ViewTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'connect', label: 'Connect & Auth', shortLabel: 'Connect', icon: Key },
  { id: 'storage', label: 'Blob Storage', shortLabel: 'Storage', icon: Database },
  { id: 'ml', label: 'Azure ML', shortLabel: 'Azure ML', icon: Cpu },
  { id: 'monitor', label: 'Job Monitor', shortLabel: 'Monitor', icon: Activity },
  { id: 'github', label: 'GitHub Tools', shortLabel: 'GitHub', icon: GitBranch },
];

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>('connect');
  const [viewportMode, setViewportMode] = useState<'responsive' | 'mobile-preview'>('responsive');
  const [statusMessage, setStatusMessage] = useState<{ text: string; tone: 'info' | 'success' | 'warning' | 'error' }>({
    text: 'Ready to connect to Azure Storage, Azure ML, or GitHub.',
    tone: 'info',
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [mobilePreviewSheetOpen, setMobilePreviewSheetOpen] = useState(false);
  const [mobileJobSheetOpen, setMobileJobSheetOpen] = useState(false);

  // Connect View local state
  const [keyAccountName, setKeyAccountName] = useState('azcloudsendstore01');
  const [keyAccountSecret, setKeyAccountSecret] = useState(
    'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='
  );

  // Storage View local state
  const [storageTab, setStorageTab] = useState<'upload' | 'browse'>('browse');
  const [selectedBlob, setSelectedBlob] = useState<BlobItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadTargetFolder, setUploadTargetFolder] = useState('datasets/custom');
  const [enablePatternValidation, setEnablePatternValidation] = useState(true);
  const [filenamePattern, setFilenamePattern] = useState('*.*');
  const [stagedLocalFiles, setStagedLocalFiles] = useState<{ name: string; size: number; content: string }[]>([
    {
      name: 'batch_inference_input.csv',
      size: 14280,
      content:
        'id,feature_1,feature_2,feature_3\n1001,0.482,1.294,-0.112\n1002,0.912,0.441,0.884\n1003,-0.215,1.890,0.012',
    },
    {
      name: 'hyperparameters.json',
      size: 640,
      content: '{\n  "batch_size": 64,\n  "optimizer": "AdamW",\n  "weight_decay": 0.01,\n  "mixed_precision": true\n}',
    },
  ]);

  // ML View local state
  const [selectedSubId, setSelectedSubId] = useState('sub-ml-prod-001');
  const [selectedRg, setSelectedRg] = useState('rg-ml-workloads-eastus');
  const [selectedWs, setSelectedWs] = useState('ws-azure-ml-primary');
  const [mlSubTab, setMlSubTab] = useState<'submit' | 'compute' | 'models'>('submit');
  const [jobNameInput, setJobNameInput] = useState(
    `job-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-gpu`
  );
  const [jobComputeInput, setJobComputeInput] = useState('gpu-nc6s-v3-cluster');
  const [jobCodePath, setJobCodePath] = useState('./cloned_repos/Azure_Cloud_Send/src_training');
  const [jobCommandInput, setJobCommandInput] = useState('python train.py --epochs 25 --lr 0.0005');
  const [jobEnvOption, setJobEnvOption] = useState<'conda' | 'docker'>('conda');
  const [jobCondaFile, setJobCondaFile] = useState('environment.yml');
  const [jobDockerImage, setJobDockerImage] = useState('mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04');

  // Job Monitor local state
  const [selectedJobName, setSelectedJobName] = useState<string>('job-20261030-114200');
  const [monitorSubTab, setMonitorSubTab] = useState<'details' | 'outputs' | 'logs'>('logs');
  const [selectedOutputFile, setSelectedOutputFile] = useState<string>('outputs/evaluation_report.html');
  const [onlyMyJobs, setOnlyMyJobs] = useState(true);

  // GitHub View local state
  const [cloneUrlInput, setCloneUrlInput] = useState(
    'https://github.com/cloud-team/azureml-gpu-training-templates.git'
  );
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('cloud-team/Azure_Cloud_Send');
  const [githubConsole, setGithubConsole] = useState<string[]>([
    '[System] Git & PyGithub handler initialized.',
    '[System] Ready for GitHub CLI or OAuth Device Flow authentication.',
  ]);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data: AppState = await res.json();
      setAppState(data);
      const container = data.azure.containerName || 'training-datasets';
      if (data.blobs[container]?.length && !selectedBlob) {
        setSelectedBlob(data.blobs[container][0]);
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to fetch backend state: ${String(err)}`, tone: 'error' });
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  if (!appState) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading Azure Cloud Send...</span>
        </div>
      </div>
    );
  }

  const currentContainer = appState.azure.containerName || 'training-datasets';
  const currentBlobs = appState.blobs[currentContainer] || [];

  // --- Handlers ---
  const handleBrowserLogin = async () => {
    setStatusMessage({ text: 'Starting Azure InteractiveBrowserCredential flow...', tone: 'info' });
    const res = await fetch('/api/azure/login-browser', { method: 'POST' });
    const data = await res.json();
    await fetchState();
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleKeyLogin = async () => {
    if (!keyAccountName.trim() || !keyAccountSecret.trim()) {
      setStatusMessage({ text: 'Account Name and Access Key are required.', tone: 'error' });
      return;
    }
    const res = await fetch('/api/azure/connect-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName: keyAccountName, accountKey: keyAccountSecret }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage({ text: data.error || 'Connection failed', tone: 'error' });
      return;
    }
    await fetchState();
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleSelectStorage = async (accountName: string, containerName: string) => {
    const res = await fetch('/api/azure/select-storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName, containerName }),
    });
    const data = await res.json();
    await fetchState();
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleSignOut = async () => {
    const res = await fetch('/api/azure/sign-out', { method: 'POST' });
    const data = await res.json();
    await fetchState();
    setActiveView('connect');
    setStatusMessage({ text: data.message, tone: 'warning' });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setStatusMessage({ text: 'Enter a folder path to create.', tone: 'warning' });
      return;
    }
    const res = await fetch('/api/blob/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerName: currentContainer, folderPath: newFolderName }),
    });
    const data = await res.json();
    setNewFolderName('');
    await fetchState();
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleLocalFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setStagedLocalFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            content:
              typeof reader.result === 'string'
                ? reader.result.slice(0, 2000)
                : `Binary file (${file.size} bytes)`,
          },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleUploadBlobs = async () => {
    const validFiles = stagedLocalFiles.filter((f) =>
      matchesWildcard(f.name, filenamePattern, enablePatternValidation)
    );
    if (!validFiles.length) {
      setStatusMessage({ text: 'No valid local files match the current validation pattern.', tone: 'warning' });
      return;
    }
    const res = await fetch('/api/blob/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerName: currentContainer,
        targetFolder: uploadTargetFolder,
        files: validFiles,
      }),
    });
    const data = await res.json();
    await fetchState();
    setStorageTab('browse');
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleDownloadBlob = (blob: BlobItem) => {
    const element = document.createElement('a');
    const file = new Blob([blob.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = blob.name.split('/').pop() || 'downloaded_blob.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setStatusMessage({ text: `Downloaded '${blob.name}' (${formatBytes(blob.size)}).`, tone: 'success' });
  };

  const handleConnectWorkspace = async () => {
    const res = await fetch('/api/ml/connect-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: selectedWs }),
    });
    const data = await res.json();
    await fetchState();
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleSubmitJob = async () => {
    if (!jobNameInput.trim() || !jobCommandInput.trim()) {
      setStatusMessage({ text: 'Job display name and command are required.', tone: 'error' });
      return;
    }
    const res = await fetch('/api/ml/submit-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobName: jobNameInput,
        computeTarget: jobComputeInput,
        codePath: jobCodePath,
        command: jobCommandInput,
        envOption: jobEnvOption,
        envValue: jobEnvOption === 'conda' ? jobCondaFile : jobDockerImage,
      }),
    });
    const data = await res.json();
    await fetchState();
    setSelectedJobName(data.job.name);
    setStatusMessage({ text: data.message, tone: 'success' });
    setActiveView('monitor');
  };

  const handleGitHubLogin = async (method: 'cli' | 'oauth') => {
    setGithubConsole((prev) => [
      ...prev,
      method === 'cli'
        ? '> Running: gh auth login --web'
        : '> Requesting GitHub OAuth Device Code (scope: repo read:user read:org)...',
    ]);
    const res = await fetch('/api/github/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    });
    const data = await res.json();
    await fetchState();
    setGithubConsole((prev) => [
      ...prev,
      `✓ ${data.message}`,
      `✓ Loaded ${data.github.repos.length} accessible repositories.`,
    ]);
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const handleCloneRepo = async (repoUrl?: string, repoName?: string) => {
    if (!repoUrl && !repoName) {
      setStatusMessage({ text: 'Please provide a repository URL or select a repository.', tone: 'warning' });
      return;
    }
    setGithubConsole((prev) => [...prev, `> git clone --progress ${repoUrl || repoName} ...`]);
    const res = await fetch('/api/github/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, repoName }),
    });
    const data = await res.json();
    await fetchState();
    setGithubConsole((prev) => [
      ...prev,
      `Receiving objects: 100% (142/142), 1.84 MiB | 6.40 MiB/s, done.`,
      `✓ ${data.message}`,
    ]);
    setStatusMessage({ text: data.message, tone: 'success' });
  };

  const selectedJob = appState.ml.jobs.find((j) => j.name === selectedJobName) || appState.ml.jobs[0];
  const filteredRepos = filterRepositories(appState.github.repos, repoSearchQuery);
  const isMobilePreview = viewportMode === 'mobile-preview';

  const renderMainWorkspaceContent = (forceMobileCards: boolean) => (
    <div className="space-y-6">
      {/* Contextual Workspace Status & Viewport Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-200">
            {appState.azure.authenticated ? appState.azure.accountName || 'Azure Signed In' : 'Azure Disconnected'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Container: <strong className="text-sky-400 font-mono">{currentContainer}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            ML: <strong className="text-slate-200">{appState.azure.connectedWorkspace || 'Not Connected'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            GitHub: <strong className="text-slate-200">{appState.github.user ? `@${appState.github.user}` : 'Guest'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Interactive Viewport Mode Switcher (Desktop vs Mobile View) */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800"
            role="group"
            aria-label="Viewport Layout Mode"
          >
            <button
              type="button"
              onClick={() => setViewportMode('responsive')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewportMode === 'responsive'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewportMode('mobile-preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewportMode === 'mobile-preview'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile View</span>
            </button>
          </div>

          {(appState.azure.authenticated || appState.github.authenticated) && (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[34px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Status Notification Banner */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {statusMessage.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                statusMessage.tone === 'success'
                  ? 'text-emerald-400'
                  : statusMessage.tone === 'warning'
                  ? 'text-amber-400'
                  : 'text-sky-400'
              }`}
            />
          )}
          <span
            className={`truncate ${
              statusMessage.tone === 'error'
                ? 'text-rose-300'
                : statusMessage.tone === 'success'
                ? 'text-emerald-300'
                : statusMessage.tone === 'warning'
                ? 'text-amber-300'
                : 'text-slate-300'
            }`}
          >
            {statusMessage.text}
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 uppercase shrink-0">{activeView}</span>
      </div>

      {/* VIEW 1: AZURE CONNECT */}
      {activeView === 'connect' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
              Azure Authentication &amp; Storage Connection
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Sign in via Azure Portal Interactive Browser Credential or connect directly with a Storage Account Access Key.
            </p>
          </div>

          {/* Azure Active Directory Authentication */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">01. Azure Active Directory Sign-In</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Client ID: <code className="text-slate-300 font-mono">04b07795-8ddb-461a-bbee-02f9e1bf7b46</code>
                </p>
              </div>
              <span className="text-xs text-slate-400">
                Status:{' '}
                <strong className={appState.azure.authenticated ? 'text-emerald-400' : 'text-slate-300'}>
                  {appState.azure.authenticated
                    ? `Signed in (${appState.azure.authMode === 'key' ? 'Access Key' : 'Browser Portal'})`
                    : 'Not Authenticated'}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBrowserLogin}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Cloud className="w-4 h-4" />
                <span>Sign in (Browser Portal)</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={!appState.azure.authenticated}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </div>
          </section>

          {/* Storage Connection Options */}
          <div className={`grid gap-6 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {/* Option A: Access Key */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">02. Connect with Storage Access Key</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-populated with the Microsoft Azurite public testing key from README.md.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="storage-account-input" className="block text-xs text-slate-400 mb-1">
                    Storage Account Name
                  </label>
                  <input
                    id="storage-account-input"
                    type="text"
                    value={keyAccountName}
                    onChange={(e) => setKeyAccountName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
                    placeholder="e.g. azcloudsendstore01"
                  />
                </div>
                <div>
                  <label htmlFor="storage-key-input" className="block text-xs text-slate-400 mb-1">
                    Access Key
                  </label>
                  <input
                    id="storage-key-input"
                    type="password"
                    value={keyAccountSecret}
                    onChange={(e) => setKeyAccountSecret(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleKeyLogin}
                  className="w-full min-h-[44px] py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-white transition-colors whitespace-nowrap"
                >
                  Connect with Key
                </button>
              </div>
            </section>

            {/* Option B: Account & Container Selector */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">03. Select Storage Account &amp; Container</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Browse accessible Azure Storage accounts and active blob containers.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="storage-account-select" className="block text-xs text-slate-400 mb-1">
                      Storage Account
                    </label>
                    <select
                      id="storage-account-select"
                      value={appState.azure.accountName || 'azcloudsendstore01'}
                      onChange={(e) => {
                        const acc = e.target.value;
                        const firstContainer = appState.azure.containers[acc]?.[0] || 'training-datasets';
                        handleSelectStorage(acc, firstContainer);
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
                    >
                      {appState.azure.storageAccounts.map((acc) => (
                        <option key={acc.name} value={acc.name}>
                          {acc.name} ({acc.resource_group})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="blob-container-select" className="block text-xs text-slate-400 mb-1">
                      Blob Container
                    </label>
                    <select
                      id="blob-container-select"
                      value={currentContainer}
                      onChange={(e) =>
                        handleSelectStorage(appState.azure.accountName || 'azcloudsendstore01', e.target.value)
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
                    >
                      {(appState.azure.containers[appState.azure.accountName || 'azcloudsendstore01'] || [
                        'training-datasets',
                      ]).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">
                  Target:{' '}
                  <strong className="text-sky-400 font-mono">
                    {appState.azure.accountName || 'azcloudsendstore01'}/{currentContainer}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveView('storage')}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-medium transition-colors whitespace-nowrap"
                >
                  Open Storage Manager →
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* VIEW 2: AZURE BLOB STORAGE */}
      {activeView === 'storage' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Azure Blob Storage Manager</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Account:{' '}
                <span className="text-slate-200 font-mono">
                  {appState.azure.accountName || 'azcloudsendstore01'}
                </span>
                <span aria-hidden="true"> · </span>
                Container: <span className="text-sky-400 font-mono">{currentContainer}</span>
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setStorageTab('browse')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  storageTab === 'browse' ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                Browse Container ({currentBlobs.length})
              </button>
              <button
                type="button"
                onClick={() => setStorageTab('upload')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  storageTab === 'upload' ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                Upload Local Files
              </button>
            </div>
          </div>

          <div className={`grid gap-6 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
            {/* Left Column: Browse or Upload */}
            <div className={forceMobileCards ? ' space-y-4' : 'lg:col-span-7 space-y-4'}>
              {storageTab === 'browse' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-sky-400" />
                      <span>Container Blobs</span>
                    </h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        aria-label="New folder path"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="New folder path..."
                        className="flex-1 sm:w-44 min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 whitespace-nowrap shrink-0"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>New Folder</span>
                      </button>
                    </div>
                  </div>

                  {/* Mobile Touch List vs Desktop Table */}
                  <div
                    className={
                      forceMobileCards
                        ? 'rounded-xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800 overflow-hidden'
                        : 'rounded-xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800 overflow-hidden md:hidden'
                    }
                  >
                    {currentBlobs.map((blob) => {
                      const isSelected = selectedBlob?.name === blob.name;
                      return (
                        <div
                          key={blob.name}
                          onClick={() => {
                            setSelectedBlob(blob);
                            setMobilePreviewSheetOpen(true);
                          }}
                          className={`p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3 min-h-[60px] ${
                            isSelected ? 'bg-sky-500/15 text-white' : 'text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs font-medium truncate text-sky-300">{blob.name}</div>
                            <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                              {formatBytes(blob.size)} · {blob.updated}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              aria-label={`Download ${blob.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadBlob(blob);
                              }}
                              className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!forceMobileCards && (
                    <div className="hidden md:block border border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                            <th className="py-2.5 px-3">Blob Path</th>
                            <th className="py-2.5 px-3 text-right">Size</th>
                            <th className="py-2.5 px-3">Last Modified</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {currentBlobs.map((blob) => {
                            const isSelected = selectedBlob?.name === blob.name;
                            return (
                              <tr
                                key={blob.name}
                                onClick={() => setSelectedBlob(blob)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-sky-500/15 text-sky-200' : 'hover:bg-slate-800/50 text-slate-300'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <span className="truncate max-w-xs">{blob.name}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-400">
                                  {formatBytes(blob.size)}
                                </td>
                                <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">{blob.updated}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadBlob(blob);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-200">Local Files Staged for Upload</h2>
                    <label className="cursor-pointer min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Add Local Files...</span>
                      <input type="file" multiple className="hidden" onChange={handleLocalFileInput} />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    <div>
                      <label htmlFor="upload-dest-input" className="block text-xs text-slate-400 mb-1">
                        Remote Destination Folder
                      </label>
                      <input
                        id="upload-dest-input"
                        type="text"
                        value={uploadTargetFolder}
                        onChange={(e) => setUploadTargetFolder(e.target.value)}
                        className="w-full min-h-[40px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                        placeholder="e.g. datasets/custom"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="pattern-input" className="text-xs text-slate-400">
                          Filename Pattern Filter
                        </label>
                        <input
                          type="checkbox"
                          aria-label="Enable filename pattern validation"
                          checked={enablePatternValidation}
                          onChange={(e) => setEnablePatternValidation(e.target.checked)}
                        />
                      </div>
                      <input
                        id="pattern-input"
                        type="text"
                        value={filenamePattern}
                        onChange={(e) => setFilenamePattern(e.target.value)}
                        disabled={!enablePatternValidation}
                        className="w-full min-h-[40px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-white font-mono disabled:opacity-40"
                        placeholder="e.g. *.csv or *.*"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {stagedLocalFiles.map((file, idx) => {
                      const valid = matchesWildcard(file.name, filenamePattern, enablePatternValidation);
                      return (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-slate-200 truncate">{file.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                              {formatBytes(file.size)} ·{' '}
                              <span className={valid ? 'text-emerald-400' : 'text-rose-400'}>
                                {valid ? 'Valid pattern' : 'Filtered out'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStagedLocalFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="min-h-[36px] px-2.5 py-1 rounded text-rose-400 hover:bg-rose-500/10 whitespace-nowrap"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400 tabular-nums">
                      {
                        stagedLocalFiles.filter((f) =>
                          matchesWildcard(f.name, filenamePattern, enablePatternValidation)
                        ).length
                      }{' '}
                      of {stagedLocalFiles.length} files valid
                    </span>
                    <button
                      type="button"
                      onClick={handleUploadBlobs}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload to /{uploadTargetFolder}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: File Inspector & Content Preview */}
            <div className={forceMobileCards ? '' : 'lg:col-span-5'}>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 h-full flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-200">Blob Content Inspector</h2>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                        {selectedBlob ? selectedBlob.name : 'Select a blob to inspect'}
                      </p>
                    </div>
                    {selectedBlob && (
                      <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                        {formatBytes(selectedBlob.size)}
                      </span>
                    )}
                  </div>

                  {selectedBlob ? (
                    <div className="mt-4">
                      <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-72">
                        {selectedBlob.content}
                      </pre>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Select any blob item to inspect its contents.
                    </div>
                  )}
                </div>

                {selectedBlob && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <span className="tabular-nums">Updated: {selectedBlob.updated}</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadBlob(selectedBlob)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-medium flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: AZURE ML WORKSPACE */}
      {activeView === 'ml' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
              Azure Machine Learning Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Connect to an Azure ML Workspace, configure Conda/Docker training environments, and submit GPU or CPU jobs.
            </p>
          </div>

          {/* Workspace Connection Bar */}
          <div
            className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 grid gap-4 items-end ${
              forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            <div>
              <label htmlFor="ml-sub-select" className="block text-xs text-slate-400 mb-1">
                Subscription
              </label>
              <select
                id="ml-sub-select"
                value={selectedSubId}
                onChange={(e) => {
                  const sub = e.target.value;
                  setSelectedSubId(sub);
                  const rgs = appState.azure.resourceGroups[sub] || [];
                  setSelectedRg(rgs[0] || '');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              >
                {appState.azure.subscriptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ml-rg-select" className="block text-xs text-slate-400 mb-1">
                Resource Group
              </label>
              <select
                id="ml-rg-select"
                value={selectedRg}
                onChange={(e) => {
                  const rg = e.target.value;
                  setSelectedRg(rg);
                  const wss = appState.azure.workspaces[rg] || [];
                  setSelectedWs(wss[0]?.name || 'ws-azure-ml-primary');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              >
                {(appState.azure.resourceGroups[selectedSubId] || []).map((rg) => (
                  <option key={rg} value={rg}>
                    {rg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ml-ws-select" className="block text-xs text-slate-400 mb-1">
                ML Workspace
              </label>
              <select
                id="ml-ws-select"
                value={selectedWs}
                onChange={(e) => setSelectedWs(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              >
                {(appState.azure.workspaces[selectedRg] || [{ name: 'ws-azure-ml-primary' }]).map((ws) => (
                  <option key={ws.name} value={ws.name}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleConnectWorkspace}
              className="min-h-[44px] py-2 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap"
            >
              Connect to Workspace
            </button>
          </div>

          {/* Operational Sub-Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMlSubTab('submit')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mlSubTab === 'submit'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Submit CommandJob
              </button>
              <button
                type="button"
                onClick={() => setMlSubTab('compute')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mlSubTab === 'compute'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compute Targets ({appState.ml.computes.length})
              </button>
              <button
                type="button"
                onClick={() => setMlSubTab('models')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mlSubTab === 'models'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Registered Models ({appState.ml.models.length})
              </button>
            </div>

            {mlSubTab === 'submit' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-200">Job Configuration</h2>
                <div className={`grid gap-4 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <div>
                    <label htmlFor="job-name-input" className="block text-xs text-slate-400 mb-1">
                      Job Display Name
                    </label>
                    <input
                      id="job-name-input"
                      type="text"
                      value={jobNameInput}
                      onChange={(e) => setJobNameInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="job-compute-select" className="block text-xs text-slate-400 mb-1">
                      Compute Target (amlcompute)
                    </label>
                    <select
                      id="job-compute-select"
                      value={jobComputeInput}
                      onChange={(e) => setJobComputeInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                    >
                      {appState.ml.computes
                        .filter((c) => c.type === 'amlcompute')
                        .map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.vmSize})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="job-code-input" className="block text-xs text-slate-400 mb-1">
                      Code Directory / Script Path
                    </label>
                    <input
                      id="job-code-input"
                      type="text"
                      value={jobCodePath}
                      onChange={(e) => setJobCodePath(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="job-cmd-input" className="block text-xs text-slate-400 mb-1">
                      Execution Command (Python / R / Bash)
                    </label>
                    <input
                      id="job-cmd-input"
                      type="text"
                      value={jobCommandInput}
                      onChange={(e) => setJobCommandInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="text-xs font-medium text-slate-300">Runtime Environment</div>
                  <div className="flex flex-wrap items-center gap-6 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <input
                        type="radio"
                        checked={jobEnvOption === 'conda'}
                        onChange={() => setJobEnvOption('conda')}
                      />
                      <span>Conda Specification File</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <input
                        type="radio"
                        checked={jobEnvOption === 'docker'}
                        onChange={() => setJobEnvOption('docker')}
                      />
                      <span>Custom Docker Image</span>
                    </label>
                  </div>

                  {jobEnvOption === 'conda' ? (
                    <input
                      type="text"
                      aria-label="Conda specification file path"
                      value={jobCondaFile}
                      onChange={(e) => setJobCondaFile(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      placeholder="environment.yml"
                    />
                  ) : (
                    <input
                      type="text"
                      aria-label="Docker image URI"
                      value={jobDockerImage}
                      onChange={(e) => setJobDockerImage(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      placeholder="mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04"
                    />
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitJob}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    <span>Submit Job to Azure ML</span>
                  </button>
                </div>
              </div>
            )}

            {mlSubTab === 'compute' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appState.ml.computes.map((c) => (
                  <div
                    key={c.name}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{c.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{c.vmSize}</div>
                      <div className="text-xs text-slate-400">
                        {c.type} · {c.location} · {c.nodes}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-400 shrink-0">{c.state}</span>
                  </div>
                ))}
              </div>
            )}

            {mlSubTab === 'models' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {appState.ml.models.map((m) => (
                  <div key={m.name} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                    <div className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                      <Box className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{m.name}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      v{m.version} · {m.framework} · <span className="text-sky-400">{m.stage}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">Created {m.createdAt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: JOB MONITOR */}
      {activeView === 'monitor' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Azure ML Job Monitor</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Inspect real-time job execution status, <code className="font-mono text-slate-300">std_log.txt</code>, and output artifacts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={onlyMyJobs}
                  onChange={(e) => setOnlyMyJobs(e.target.checked)}
                />
                <span>Show only my jobs</span>
              </label>
              <button
                type="button"
                onClick={fetchState}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className={`grid gap-6 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
            {/* Left Job List */}
            <div className={forceMobileCards ? 'space-y-2.5' : 'lg:col-span-5 space-y-2.5'}>
              {appState.ml.jobs.map((job) => {
                const isSelected = selectedJob?.name === job.name;
                return (
                  <div
                    key={job.name}
                    onClick={() => {
                      setSelectedJobName(job.name);
                      setMobileJobSheetOpen(true);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors min-h-[68px] flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold text-white truncate">{job.name}</div>
                      <div className="text-xs text-slate-300 truncate mt-0.5">{job.displayName}</div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                        {job.compute} · {job.createdAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-medium ${
                          job.status === 'Completed' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {job.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 lg:hidden" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Details Notebook */}
            <div
              className={`${
                forceMobileCards ? '' : 'lg:col-span-7'
              } rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMonitorSubTab('details')}
                    className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                      monitorSubTab === 'details'
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitorSubTab('outputs')}
                    className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                      monitorSubTab === 'outputs'
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Outputs ({selectedJob?.outputs.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitorSubTab('logs')}
                    className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                      monitorSubTab === 'logs'
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    std_log.txt
                  </button>
                </div>
                <span className="text-xs font-mono text-slate-400">{selectedJob?.name}</span>
              </div>

              {selectedJob && monitorSubTab === 'details' && (
                <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500">Name:</span> <span className="text-white">{selectedJob.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Display Name:</span>{' '}
                    <span className="text-sky-400">{selectedJob.displayName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Status:</span>{' '}
                    <span className="text-emerald-400">{selectedJob.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Compute Target:</span>{' '}
                    <span className="text-slate-200">{selectedJob.compute}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Experiment:</span>{' '}
                    <span className="text-slate-200">{selectedJob.experiment}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Command:</span>{' '}
                    <span className="text-amber-300">{selectedJob.command}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Environment:</span>{' '}
                    <span className="text-slate-300">{selectedJob.environment}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Created At:</span>{' '}
                    <span className="text-slate-400 tabular-nums">{selectedJob.createdAt}</span>
                  </div>
                </div>
              )}

              {selectedJob && monitorSubTab === 'logs' && (
                <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
                  {selectedJob.logs}
                </pre>
              )}

              {selectedJob && monitorSubTab === 'outputs' && (
                <div className={`grid gap-4 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <div className="border border-slate-800 rounded-lg bg-slate-950 p-2 space-y-1">
                    {selectedJob.outputs.map((out) => (
                      <button
                        type="button"
                        key={out}
                        onClick={() => setSelectedOutputFile(out)}
                        className={`w-full text-left min-h-[40px] px-3 py-2 rounded text-xs font-mono transition-colors ${
                          selectedOutputFile === out
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        {out}
                      </button>
                    ))}
                  </div>
                  <div className="border border-slate-800 rounded-lg bg-slate-950 p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-sky-400 break-all">{selectedOutputFile}</div>
                      <p className="text-xs text-slate-400">
                        {selectedOutputFile.endsWith('.png')
                          ? 'Diagnostic Plot Artifact (Loss / Residuals / Confusion Matrix) rendered from job run.'
                          : 'Evaluation Summary Artifact generated by Azure ML CommandJob.'}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadBlob({
                            name: selectedOutputFile,
                            size: 4096,
                            type: 'text',
                            updated: selectedJob.createdAt,
                            content: `Artifact output from job ${selectedJob.name}: ${selectedOutputFile}`,
                          })
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Output</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: GITHUB TOOLS */}
      {activeView === 'github' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                GitHub Repository &amp; Source Control
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Authenticate with GitHub CLI or OAuth Device Flow, browse repositories, and clone training scripts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleGitHubLogin('cli')}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white whitespace-nowrap"
              >
                Login with GitHub CLI
              </button>
              <button
                type="button"
                onClick={() => handleGitHubLogin('oauth')}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs whitespace-nowrap"
              >
                Login with OAuth
              </button>
            </div>
          </div>

          {/* Clone from URL Bar */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label htmlFor="clone-url-input" className="text-xs font-medium text-slate-300 shrink-0">
              Clone URL:
            </label>
            <input
              id="clone-url-input"
              type="text"
              value={cloneUrlInput}
              onChange={(e) => setCloneUrlInput(e.target.value)}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              placeholder="https://github.com/owner/repository.git"
            />
            <button
              type="button"
              onClick={() => handleCloneRepo(cloneUrlInput)}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs whitespace-nowrap"
            >
              Clone Repository
            </button>
          </div>

          <div className={`grid gap-6 ${forceMobileCards ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
            {/* Repositories List */}
            <div
              className={`${
                forceMobileCards ? '' : 'lg:col-span-7'
              } rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Accessible Repositories</h2>
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    aria-label="Filter repositories"
                    value={repoSearchQuery}
                    onChange={(e) => setRepoSearchQuery(e.target.value)}
                    placeholder="Filter repositories..."
                    className="w-full sm:w-52 min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepoFullName === repo.nameWithOwner;
                  return (
                    <div
                      key={repo.nameWithOwner}
                      onClick={() => setSelectedRepoFullName(repo.nameWithOwner)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-500/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-white truncate">
                          {repo.nameWithOwner}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {repo.visibility}
                          {repo.cloned ? ' · Cloned locally' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{repo.description}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400">
                        <span>
                          {repo.language || 'Python'} · ★ {repo.stars ?? 0}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloneRepo(repo.clone_url, repo.nameWithOwner);
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap"
                          >
                            Clone Selected
                          </button>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Console Output */}
            <div
              className={`${
                forceMobileCards ? '' : 'lg:col-span-5'
              } rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span>Git Console Output</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setGithubConsole(['[Console cleared]'])}
                  className="text-xs text-slate-400 hover:text-slate-200 min-h-[36px] px-2"
                >
                  Clear
                </button>
              </div>
              <div className="flex-1 rounded-lg bg-slate-950 border border-slate-800 p-3.5 font-mono text-xs text-slate-300 space-y-1.5 overflow-y-auto max-h-80">
                {githubConsole.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('connect');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Azure Cloud Send
        </a>

        {/* Zone 2: 5 concise single-line text navigation links (Desktop) */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeView === item.id
                  ? 'text-sky-400 border-sky-400 font-semibold'
                  : 'text-slate-400 border-transparent hover:text-slate-100'
              }`}
            >
              {item.shortLabel}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Auth Guide</span>
          </button>
        </div>
      </header>

      {/* Main Layout Area: Either Full Responsive View or Interactive Mobile Handset Preview */}
      {isMobilePreview ? (
        <div className="flex-1 bg-slate-950 py-4 px-4 flex flex-col items-center justify-center">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Interactive Mobile Handset View (390 × 760px Touch Ergonomics)
            </span>
            <button
              type="button"
              onClick={() => setViewportMode('responsive')}
              className="px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-sky-400 font-medium"
            >
              Return to Full Desktop Layout
            </button>
          </div>

          {/* Simulated 390px Smartphone Frame with Bottom Tab Navigation */}
          <div
            data-testid="mobile-handset-frame"
            className="w-full max-w-[390px] h-[750px] bg-slate-950 border-2 border-slate-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col shrink-0"
          >
            {/* Mobile Frame Top Status Bar */}
            <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              <span className="font-semibold text-white truncate">
                {NAV_ITEMS.find((n) => n.id === activeView)?.label}
              </span>
              <span className="font-mono text-[11px] text-sky-400">
                {appState.azure.authenticated ? 'Azure Ready' : 'Offline'}
              </span>
            </div>

            {/* Mobile Frame Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4">{renderMainWorkspaceContent(true)}</div>

            {/* Mobile Frame Bottom Tab Bar */}
            <nav
              aria-label="Mobile Handset Bottom Navigation"
              className="grid grid-cols-5 items-center h-16 bg-slate-900/95 border-t border-slate-800 px-1 shrink-0"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                      active ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] tracking-tight mt-1 whitespace-nowrap">{item.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden pb-16 md:pb-0">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden md:flex w-60 border-r border-slate-800 bg-slate-900/40 p-4 flex-col justify-between shrink-0">
            <div className="space-y-6">
              <nav aria-label="Sidebar Navigation" className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveView(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'storage' && (
                        <span className="text-xs text-slate-400 font-mono tabular-nums">{currentBlobs.length}</span>
                      )}
                      {item.id === 'monitor' && (
                        <span className="text-xs text-slate-400 font-mono tabular-nums">
                          {appState.ml.jobs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 space-y-2 text-xs text-slate-400">
              <div className="font-medium text-slate-200">Runtime SDK Status</div>
              <div className="flex items-center justify-between">
                <span>azure-storage-blob</span>
                <span className="text-emerald-400 font-mono text-[11px]">Ready</span>
              </div>
              <div className="flex items-center justify-between">
                <span>azure-ai-ml</span>
                <span className="text-emerald-400 font-mono text-[11px]">Ready</span>
              </div>
              <div className="flex items-center justify-between">
                <span>PyGithub / git</span>
                <span className="text-emerald-400 font-mono text-[11px]">Ready</span>
              </div>
            </div>
          </aside>

          {/* Main Content Viewport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {renderMainWorkspaceContent(false)}
          </main>
        </div>
      )}

      {/* Fixed Bottom Tab Bar for Real Smartphone Viewports (<768px) */}
      {!isMobilePreview && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 items-center px-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                  active ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight mt-1 whitespace-nowrap">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Mobile Bottom Sheet for Blob Preview on Small Viewports or Mobile Preview */}
      {mobilePreviewSheetOpen && selectedBlob && (
        <div
          className={`${
            isMobilePreview ? 'fixed' : 'md:hidden fixed'
          } inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center`}
          onClick={() => setMobilePreviewSheetOpen(false)}
        >
          <div
            className="w-full max-w-[390px] bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs text-sky-400 truncate pr-2">{selectedBlob.name}</div>
              <button
                type="button"
                aria-label="Close blob preview"
                onClick={() => setMobilePreviewSheetOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-60">
              {selectedBlob.content}
            </pre>
            <button
              type="button"
              onClick={() => handleDownloadBlob(selectedBlob)}
              className="w-full min-h-[48px] rounded-xl bg-sky-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download {selectedBlob.name.split('/').pop()}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet for Job Logs on Small Viewports or Mobile Preview */}
      {mobileJobSheetOpen && selectedJob && (
        <div
          className={`${
            isMobilePreview ? 'fixed' : 'lg:hidden fixed'
          } inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center`}
          onClick={() => setMobileJobSheetOpen(false)}
        >
          <div
            className="w-full max-w-[390px] bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-semibold text-white">{selectedJob.name}</div>
                <div className="text-xs text-sky-400">{selectedJob.displayName}</div>
              </div>
              <button
                type="button"
                aria-label="Close job details"
                onClick={() => setMobileJobSheetOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64">
              {selectedJob.logs}
            </pre>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-guide-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="auth-guide-title" className="text-base font-semibold text-white">
                Azure &amp; GitHub Authentication Guide
              </h2>
              <button
                type="button"
                aria-label="Close authentication guide"
                onClick={() => setShowHelpModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong className="text-white">01. Browser Sign-In:</strong> Uses Azure Active Directory Interactive
                Browser authentication to discover your Subscriptions, Resource Groups, Storage Accounts, and Machine
                Learning Workspaces.
              </p>
              <p>
                <strong className="text-white">02. Access Key Sign-In:</strong> Connects directly to an Azure Blob
                Storage account or local Azurite emulator using an Account Name and Access Key.
              </p>
              <p>
                <strong className="text-white">03. Mobile &amp; Responsive View:</strong> Use the bottom navigation bar
                on mobile screens or toggle the interactive Mobile Handset View from the workspace toolbar.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="min-h-[40px] px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
