import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, matchesWildcard, filterRepositories, SearchableRepo } from './cloudUtils';

test('formatBytes formats byte, kilobyte, and megabyte sizes accurately', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(31457280), '30.0 MB');
  assert.equal(formatBytes(-50), '0 B');
});

test('matchesWildcard validates filenames against glob patterns', () => {
  assert.equal(matchesWildcard('train.py', '*.*', true), true);
  assert.equal(matchesWildcard('sensor_readings.csv', '*.csv', true), true);
  assert.equal(matchesWildcard('hyperparameters.json', '*.csv', true), false);
  assert.equal(matchesWildcard('hyperparameters.json', '*.csv', false), true);
  assert.equal(matchesWildcard('batch_1.bin', 'batch_?.bin', true), true);
  assert.equal(matchesWildcard('batch_12.bin', 'batch_?.bin', true), false);
});

test('filterRepositories filters by owner/name, description, and language', () => {
  const sampleRepos: SearchableRepo[] = [
    {
      name: 'Azure_Cloud_Send',
      nameWithOwner: 'cloud-team/Azure_Cloud_Send',
      visibility: 'public',
      clone_url: 'https://github.com/cloud-team/Azure_Cloud_Send.git',
      html_url: 'https://github.com/cloud-team/Azure_Cloud_Send',
      description: 'Deploying ML Models to Azure Cloud',
      language: 'Python',
      updated_at: '2026-10-30T12:00:00Z',
    },
    {
      name: 'azurite-blob-emulator-suite',
      nameWithOwner: 'cloud-team/azurite-blob-emulator-suite',
      visibility: 'private',
      clone_url: 'https://github.com/cloud-team/azurite-blob-emulator-suite.git',
      html_url: 'https://github.com/cloud-team/azurite-blob-emulator-suite',
      description: 'Local Azurite storage container validator',
      language: 'TypeScript',
      updated_at: '2026-10-24T09:45:00Z',
    },
  ];

  assert.equal(filterRepositories(sampleRepos, '').length, 2);
  assert.equal(filterRepositories(sampleRepos, 'azurite').length, 1);
  assert.equal(filterRepositories(sampleRepos, 'typescript').length, 1);
  assert.equal(filterRepositories(sampleRepos, 'nonexistent').length, 0);
});
