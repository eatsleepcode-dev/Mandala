/*
---
title: CredentialManager Tests
description: TDD suite for generic SecretStorage credential management
scope: credentials, security
created: 2026-05-13
---
*/

import { CredentialManager } from './credentials';
import * as vscode from 'vscode';

describe('CredentialManager', () => {
  let mockSecretStorage: vscode.SecretStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    mockSecretStorage = {
      get: jest.fn(async (key: string) => store.get(key)),
      store: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      onDidChange: jest.fn(),
    } as unknown as vscode.SecretStorage;
  });

  it('stores_secret_in_secret_storage', async () => {
    const manager = new CredentialManager(mockSecretStorage);
    await manager.storeSecret('mandala.ado.pat', 'super-secret-pat');

    expect(mockSecretStorage.store).toHaveBeenCalledWith('mandala.ado.pat', 'super-secret-pat');
    expect(await mockSecretStorage.get('mandala.ado.pat')).toBe('super-secret-pat');
  });

  it('retrieves_secret_from_secret_storage', async () => {
    const manager = new CredentialManager(mockSecretStorage);
    await mockSecretStorage.store('mandala.claude.key', 'claude-api-key-123');

    const retrieved = await manager.getSecret('mandala.claude.key');
    expect(mockSecretStorage.get).toHaveBeenCalledWith('mandala.claude.key');
    expect(retrieved).toBe('claude-api-key-123');
  });

  it('returns_undefined_for_missing_secret', async () => {
    const manager = new CredentialManager(mockSecretStorage);
    const retrieved = await manager.getSecret('mandala.unknown.key');
    
    expect(retrieved).toBeUndefined();
  });
});
