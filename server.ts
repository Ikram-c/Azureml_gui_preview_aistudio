import 'dotenv/config';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store replicating the Python handlers (AzureAuthHandler, AzureBlobHandler, AzureMLHandler, GitHubHandler)
const state = {
  azure: {
    authenticated: false,
    authMode: null as 'browser' | 'key' | null,
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    accountName: '',
    containerName: '',
    connectedWorkspace: '',
    subscriptions: [
      { id: 'sub-ml-prod-001', name: 'Azure Cloud Production' },
      { id: 'sub-ml-dev-002', name: 'Data Science R&D Sandbox' },
    ],
    resourceGroups: {
      'sub-ml-prod-001': ['rg-ml-workloads-eastus', 'rg-storage-hub-prod', 'rg-vision-pipeline'],
      'sub-ml-dev-002': ['rg-sandbox-experiments', 'rg-azurite-dev'],
    } as Record<string, string[]>,
    storageAccounts: [
      { name: 'azcloudsendstore01', resource_group: 'rg-storage-hub-prod', subscription_id: 'sub-ml-prod-001' },
      { name: 'mldatasetsblobprod', resource_group: 'rg-ml-workloads-eastus', subscription_id: 'sub-ml-prod-001' },
      { name: 'devstorageazurite', resource_group: 'rg-azurite-dev', subscription_id: 'sub-ml-dev-002' },
    ],
    containers: {
      azcloudsendstore01: ['training-datasets', 'model-checkpoints', 'inference-outputs', 'raw-telemetry'],
      mldatasetsblobprod: ['vision-images-v2', 'nlp-corpora', 'evaluation-benchmarks'],
      devstorageazurite: ['local-test-blobs', 'debug-artifacts'],
    } as Record<string, string[]>,
    workspaces: {
      'rg-ml-workloads-eastus': [
        { name: 'ws-azure-ml-primary', id: '/subscriptions/sub-ml-prod-001/resourceGroups/rg-ml-workloads-eastus/providers/Microsoft.MachineLearningServices/workspaces/ws-azure-ml-primary' },
        { name: 'ws-gpu-cluster-hub', id: '/subscriptions/sub-ml-prod-001/resourceGroups/rg-ml-workloads-eastus/providers/Microsoft.MachineLearningServices/workspaces/ws-gpu-cluster-hub' },
      ],
      'rg-vision-pipeline': [
        { name: 'ws-cv-training', id: '/subscriptions/sub-ml-prod-001/resourceGroups/rg-vision-pipeline/providers/Microsoft.MachineLearningServices/workspaces/ws-cv-training' },
      ],
      'rg-sandbox-experiments': [
        { name: 'ws-dev-playground', id: '/subscriptions/sub-ml-dev-002/resourceGroups/rg-sandbox-experiments/providers/Microsoft.MachineLearningServices/workspaces/ws-dev-playground' },
      ],
    } as Record<string, { name: string; id: string }[]>,
  },
  blobs: {
    'training-datasets': [
      { name: 'datasets/cifar10/train_batch_1.bin', size: 31457280, type: 'binary', updated: '2026-10-28 14:22:10', content: 'Binary dataset batch #1 (30 MB) - CIFAR-10 training vectors' },
      { name: 'datasets/cifar10/labels_meta.json', size: 4210, type: 'json', updated: '2026-10-28 14:22:15', content: '{\n  "dataset": "CIFAR-10",\n  "classes": ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"],\n  "num_samples": 50000,\n  "normalization": "mean=[0.4914, 0.4822, 0.4465]"\n}' },
      { name: 'datasets/tabular/sensor_readings_2026.csv', size: 1482900, type: 'text', updated: '2026-10-29 09:15:00', content: 'timestamp,sensor_id,temperature_c,vibration_hz,pressure_kpa,anomaly_flag\n2026-10-29T00:00:01Z,SNS-101,42.3,18.4,101.2,0\n2026-10-29T00:00:02Z,SNS-102,44.1,19.1,101.5,0\n2026-10-29T00:00:03Z,SNS-104,78.9,64.2,118.0,1\n2026-10-29T00:00:04Z,SNS-101,42.5,18.2,101.3,0' },
      { name: 'scripts/train.py', size: 3840, type: 'text', updated: '2026-10-30 11:05:44', content: 'import argparse\nimport torch\nimport torch.nn as nn\n\ndef main():\n    parser = argparse.ArgumentParser()\n    parser.add_argument("--epochs", type=int, default=25)\n    parser.add_argument("--lr", type=float, default=0.001)\n    args = parser.parse_args()\n    print(f"Starting Azure ML distributed training for {args.epochs} epochs (lr={args.lr})...")\n\nif __name__ == "__main__":\n    main()' },
      { name: 'configs/environment.yml', size: 612, type: 'text', updated: '2026-10-30 11:06:12', content: 'name: azureml-gpu-env\nchannels:\n  - pytorch\n  - conda-forge\n  - defaults\ndependencies:\n  - python=3.11\n  - pytorch=2.4.0\n  - torchvision\n  - scikit-learn\n  - pip:\n    - azureml-mlflow\n    - matplotlib' },
    ],
    'model-checkpoints': [
      { name: 'resnet50/epoch_25_best.pt', size: 98450120, type: 'binary', updated: '2026-10-29 18:40:00', content: 'PyTorch StateDict Checkpoint - ResNet50 val_acc=0.942' },
      { name: 'resnet50/training_metrics.json', size: 1890, type: 'json', updated: '2026-10-29 18:40:05', content: '{\n  "model": "ResNet50-v2",\n  "best_epoch": 25,\n  "val_accuracy": 0.942,\n  "val_loss": 0.184,\n  "compute": "gpu-nc6s-v3-cluster"\n}' },
    ],
  } as Record<string, { name: string; size: number; type: string; updated: string; content: string }[]>,
  ml: {
    computes: [
      { name: 'gpu-nc6s-v3-cluster', type: 'amlcompute', state: 'Succeeded', location: 'eastus', vmSize: 'Standard_NC6s_v3 (Tesla V100)', nodes: '2 / 8 active' },
      { name: 'cpu-ds3-v2-cluster', type: 'amlcompute', state: 'Succeeded', location: 'eastus', vmSize: 'Standard_DS3_v2', nodes: '1 / 4 active' },
      { name: 'gpu-a100-distributed', type: 'amlcompute', state: 'Succeeded', location: 'westus2', vmSize: 'Standard_ND96asr_v4 (8x A100)', nodes: '0 / 4 idle' },
      { name: 'dev-workstation-vm', type: 'ComputeInstance', state: 'Running', location: 'eastus', vmSize: 'Standard_DS12_v2', nodes: '1 instance' },
    ],
    models: [
      { name: 'anomaly-detector-xgboost', version: '4', createdAt: '2026-10-29 16:40', framework: 'XGBoost 2.1', stage: 'Production' },
      { name: 'vision-defect-resnet50', version: '12', createdAt: '2026-10-28 11:20', framework: 'PyTorch 2.4', stage: 'Production' },
      { name: 'timeseries-forecaster-tft', version: '2', createdAt: '2026-10-25 09:05', framework: 'PyTorch Lightning', stage: 'Staging' },
    ],
    jobs: [
      {
        name: 'job-20261030-114200',
        displayName: 'vision-resnet50-finetune',
        status: 'Completed',
        compute: 'gpu-nc6s-v3-cluster',
        experiment: 'local-ui-submissions',
        command: 'python train.py --epochs 25 --lr 0.0005 --batch-size 64',
        environment: 'conda: environment.yml (mcr.microsoft.com/azureml/openmpi3.1.2-ubuntu18.04)',
        createdAt: '2026-10-30 11:42:00',
        outputs: ['outputs/confusion_matrix.png', 'outputs/loss_curve.png', 'outputs/evaluation_report.html', 'outputs/metrics_summary.json'],
        logs: `[2026-10-30 11:42:04] Initializing AzureML CommandJob on compute target 'gpu-nc6s-v3-cluster'
[2026-10-30 11:42:12] Mounting Blob Container 'training-datasets' from account 'azcloudsendstore01'
[2026-10-30 11:42:19] Conda environment 'job-20261030-114200-env' resolved cleanly.
[2026-10-30 11:42:25] CUDA Device 0: NVIDIA Tesla V100-PCIE-16GB (16160 MiB)
[2026-10-30 11:42:30] Epoch [01/25] - train_loss: 1.4821 - val_loss: 1.1204 - val_acc: 0.6240
[2026-10-30 11:44:10] Epoch [10/25] - train_loss: 0.4319 - val_loss: 0.3812 - val_acc: 0.8790
[2026-10-30 11:46:55] Epoch [25/25] - train_loss: 0.1402 - val_loss: 0.1840 - val_acc: 0.9420
[2026-10-30 11:47:01] Saving model artifacts to ./outputs/model_best.pt
[2026-10-30 11:47:04] Uploading user_logs/std_log.txt and evaluation plots to workspace blob store.
[2026-10-30 11:47:05] Job execution completed with exit code 0.`,
      },
      {
        name: 'job-20261030-125015',
        displayName: 'sensor-anomaly-sweep',
        status: 'Running',
        compute: 'cpu-ds3-v2-cluster',
        experiment: 'local-ui-submissions',
        command: 'python train_anomaly.py --input sensor_readings_2026.csv --n-estimators 500',
        environment: 'AzureML-sklearn-1.0-ubuntu20.04-py38-cpu@latest',
        createdAt: '2026-10-30 12:50:15',
        outputs: ['outputs/feature_importance.png', 'outputs/validation_predictions.csv'],
        logs: `[2026-10-30 12:50:18] Starting job on cpu-ds3-v2-cluster (4 vCPUs, 14 GB RAM)
[2026-10-30 12:50:25] Loaded 148,290 sensor rows from sensor_readings_2026.csv
[2026-10-30 12:50:40] Running 5-fold stratified cross-validation...
[2026-10-30 12:51:12] Fold 1/5 AUC-ROC: 0.9814 | Precision@95: 0.934
[2026-10-30 12:51:49] Fold 2/5 AUC-ROC: 0.9842 | Precision@95: 0.941
[2026-10-30 12:52:20] Fold 3/5 in progress...`,
      },
      {
        name: 'job-20261029-191022',
        displayName: 'r-spatial-regression-pipeline',
        status: 'Completed',
        compute: 'cpu-ds3-v2-cluster',
        experiment: 'local-ui-submissions',
        command: 'Rscript run_spatial_model.R --threads 4',
        environment: 'docker: mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04',
        createdAt: '2026-10-29 19:10:22',
        outputs: ['outputs/spatial_residuals.png', 'outputs/summary_stats.html'],
        logs: `[2026-10-29 19:10:25] Pulling Docker image mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04
[2026-10-29 19:11:02] Executing Rscript run_spatial_model.R --threads 4
[2026-10-29 19:12:40] Spatial autocorrelation Moran's I = 0.712 (p < 0.0001)
[2026-10-29 19:13:15] Saved residual diagnostics to outputs/spatial_residuals.png
[2026-10-29 19:13:18] Job finished cleanly.`,
      },
    ],
  },
  github: {
    authenticated: false,
    user: null as string | null,
    repos: [
      {
        name: 'Azure_Cloud_Send',
        nameWithOwner: 'cloud-team/Azure_Cloud_Send',
        visibility: 'public',
        clone_url: 'https://github.com/cloud-team/Azure_Cloud_Send.git',
        html_url: 'https://github.com/cloud-team/Azure_Cloud_Send',
        description: 'The Unofficial Repo for Deploying ML Models & Datasets to Azure Cloud & Blob Storage',
        language: 'Python',
        stars: 42,
        updated_at: '2026-10-30T12:00:00Z',
        cloned: true,
      },
      {
        name: 'azureml-gpu-training-templates',
        nameWithOwner: 'cloud-team/azureml-gpu-training-templates',
        visibility: 'public',
        clone_url: 'https://github.com/cloud-team/azureml-gpu-training-templates.git',
        html_url: 'https://github.com/cloud-team/azureml-gpu-training-templates',
        description: 'Boilerplate PyTorch, R, and Bash training pipelines for Azure Machine Learning Compute',
        language: 'Python',
        stars: 29,
        updated_at: '2026-10-28T16:20:00Z',
        cloned: false,
      },
      {
        name: 'azurite-blob-emulator-suite',
        nameWithOwner: 'cloud-team/azurite-blob-emulator-suite',
        visibility: 'private',
        clone_url: 'https://github.com/cloud-team/azurite-blob-emulator-suite.git',
        html_url: 'https://github.com/cloud-team/azurite-blob-emulator-suite',
        description: 'Local Azurite storage container synchronization and filename pattern validator',
        language: 'TypeScript',
        stars: 15,
        updated_at: '2026-10-24T09:45:00Z',
        cloned: false,
      },
    ],
  },
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({limit: '10mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({status: 'ok'});
  });

  // --- Full State Endpoint ---
  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  // --- Azure Auth Endpoints ---
  app.post('/api/azure/login-browser', (_req, res) => {
    state.azure.authenticated = true;
    state.azure.authMode = 'browser';
    state.azure.accountName = 'azcloudsendstore01';
    state.azure.containerName = 'training-datasets';
    res.json({
      message: `Signed in to tenant: ${state.azure.tenantId}`,
      azure: state.azure,
    });
  });

  app.post('/api/azure/connect-key', (req, res) => {
    const { accountName, accountKey } = req.body;
    if (!accountName || !accountKey) {
      res.status(400).json({ error: 'Account Name and Access Key are required.' });
      return;
    }
    state.azure.authenticated = true;
    state.azure.authMode = 'key';
    state.azure.accountName = accountName;
    if (!state.azure.containers[accountName]) {
      state.azure.containers[accountName] = ['training-datasets', 'model-checkpoints', 'custom-uploads'];
    }
    state.azure.containerName = state.azure.containers[accountName][0];
    res.json({
      message: `Connected to storage account '${accountName}' via Access Key.`,
      containers: state.azure.containers[accountName],
      azure: state.azure,
    });
  });

  app.post('/api/azure/select-storage', (req, res) => {
    const { accountName, containerName } = req.body;
    if (accountName) state.azure.accountName = accountName;
    if (containerName) state.azure.containerName = containerName;
    if (containerName && !state.blobs[containerName]) {
      state.blobs[containerName] = [
        {
          name: 'readme_container.txt',
          size: 256,
          type: 'text',
          updated: new Date().toISOString().slice(0, 19).replace('T', ' '),
          content: `Container '${containerName}' in storage account '${state.azure.accountName}'. Ready for blob uploads and downloads.`,
        },
      ];
    }
    res.json({
      message: `Connected to ${state.azure.accountName} / ${state.azure.containerName}`,
      azure: state.azure,
    });
  });

  app.post('/api/azure/sign-out', (_req, res) => {
    state.azure.authenticated = false;
    state.azure.authMode = null;
    state.azure.accountName = '';
    state.azure.containerName = '';
    state.azure.connectedWorkspace = '';
    state.github.authenticated = false;
    state.github.user = null;
    res.json({ message: 'Signed out from all cloud services.', state });
  });

  // --- Azure Blob Endpoints ---
  app.post('/api/blob/create-folder', (req, res) => {
    const { containerName, folderPath } = req.body;
    const targetContainer = containerName || state.azure.containerName || 'training-datasets';
    const cleanFolder = (folderPath || 'new-folder').replace(/^\/+|\/+$/g, '');
    if (!state.blobs[targetContainer]) {
      state.blobs[targetContainer] = [];
    }
    const markerName = `${cleanFolder}/.folder_marker`;
    const exists = state.blobs[targetContainer].some((b) => b.name === markerName);
    if (!exists) {
      state.blobs[targetContainer].push({
        name: markerName,
        size: 0,
        type: 'text',
        updated: new Date().toISOString().slice(0, 19).replace('T', ' '),
        content: 'Empty folder marker created by AzureBlobHandler',
      });
    }
    res.json({
      message: `Folder '${cleanFolder}/' created successfully.`,
      blobs: state.blobs[targetContainer],
    });
  });

  app.post('/api/blob/upload', (req, res) => {
    const { containerName, files, targetFolder } = req.body;
    const targetContainer = containerName || state.azure.containerName || 'training-datasets';
    if (!state.blobs[targetContainer]) {
      state.blobs[targetContainer] = [];
    }
    const prefix = targetFolder ? `${targetFolder.replace(/^\/+|\/+$/g, '')}/` : '';
    const uploaded: string[] = [];

    for (const file of files || []) {
      const fullPath = `${prefix}${file.name}`;
      const existingIdx = state.blobs[targetContainer].findIndex((b) => b.name === fullPath);
      const blobRecord = {
        name: fullPath,
        size: file.size || 2048,
        type: file.name.endsWith('.json') ? 'json' : 'text',
        updated: new Date().toISOString().slice(0, 19).replace('T', ' '),
        content: file.content || `Uploaded file '${file.name}' (${file.size || 2048} bytes) to ${targetContainer}/${fullPath}`,
      };
      if (existingIdx >= 0) {
        state.blobs[targetContainer][existingIdx] = blobRecord;
      } else {
        state.blobs[targetContainer].push(blobRecord);
      }
      uploaded.push(fullPath);
    }

    res.json({
      message: `Uploaded ${uploaded.length} file(s) to ${targetContainer}.`,
      blobs: state.blobs[targetContainer],
    });
  });

  // --- Azure ML Endpoints ---
  app.post('/api/ml/connect-workspace', (req, res) => {
    const { workspaceName } = req.body;
    state.azure.connectedWorkspace = workspaceName || 'ws-azure-ml-primary';
    res.json({
      message: `Connected to workspace: ${state.azure.connectedWorkspace}`,
      workspace: state.azure.connectedWorkspace,
    });
  });

  app.post('/api/ml/submit-job', (req, res) => {
    const { jobName, computeTarget, command, envOption, envValue, codePath } = req.body;
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const name = jobName || `job-${Date.now()}`;
    const envDesc = envOption === 'docker' ? `docker: ${envValue || 'mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04'}` : `conda: ${envValue || 'environment.yml'}`;

    const newJob = {
      name,
      displayName: name,
      status: 'Running',
      compute: computeTarget || 'gpu-nc6s-v3-cluster',
      experiment: 'local-ui-submissions',
      command: command || 'python train.py',
      environment: envDesc,
      createdAt: nowStr,
      outputs: ['outputs/training_metrics.json', 'outputs/loss_curve.png'],
      logs: `[${nowStr}] Submitting CommandJob '${name}' to Azure ML Workspace '${state.azure.connectedWorkspace || 'ws-azure-ml-primary'}'\n[${nowStr}] Uploading source directory '${codePath || './src_training'}'...\n[${nowStr}] Provisioning environment (${envDesc}) on compute target '${computeTarget || 'gpu-nc6s-v3-cluster'}'\n[${nowStr}] Executing command: ${command || 'python train.py'}\n[${nowStr}] Streaming stdout from remote container...\n[${nowStr}] Epoch 1/10 - loss: 0.8120 - acc: 0.7650`,
    };

    state.ml.jobs.unshift(newJob);
    res.json({
      message: `Job '${name}' submitted to ${newJob.compute}.`,
      job: newJob,
      jobs: state.ml.jobs,
    });
  });

  // --- GitHub Endpoints ---
  app.post('/api/github/login', (req, res) => {
    const { method, token } = req.body;
    state.github.authenticated = true;
    state.github.user = method === 'oauth' ? 'azure-cloud-dev' : 'gh-cli-engineer';
    res.json({
      message: `Successfully authenticated as ${state.github.user} (${method === 'oauth' ? 'OAuth Device Flow' : token ? 'Personal Access Token' : 'GitHub CLI'}).`,
      github: state.github,
    });
  });

  app.post('/api/github/clone', (req, res) => {
    const { repoUrl, repoName } = req.body;
    const targetName = repoName || (repoUrl ? repoUrl.replace(/\.git$/, '').split('/').pop() : 'custom-repo');
    const existing = state.github.repos.find((r) => r.nameWithOwner === repoName || r.name === targetName);
    if (existing) {
      existing.cloned = true;
    } else if (repoUrl) {
      state.github.repos.unshift({
        name: targetName || 'cloned-repo',
        nameWithOwner: `external/${targetName || 'cloned-repo'}`,
        visibility: 'public',
        clone_url: repoUrl,
        html_url: repoUrl.replace(/\.git$/, ''),
        description: 'Repository cloned via URL',
        language: 'Python',
        stars: 1,
        updated_at: new Date().toISOString(),
        cloned: true,
      });
    }
    res.json({
      message: `Successfully cloned to /app/applet/cloned_repos/${targetName}`,
      repos: state.github.repos,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
