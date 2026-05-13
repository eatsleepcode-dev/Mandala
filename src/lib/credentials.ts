/*
---
title: CredentialManager
description: Handles secure storage of API keys and PATs using VS Code SecretStorage
scope: credentials, security
created: 2026-05-13
---
*/

import * as vscode from 'vscode';

export class CredentialManager {
  private _secretStorage: vscode.SecretStorage;

  constructor(secretStorage: vscode.SecretStorage) {
    this._secretStorage = secretStorage;
  }

  /**
   * Securely store a secret credential using the OS keychain.
   * @param key The key to store the secret under (e.g. 'mandala.ado.pat')
   * @param value The secret value
   */
  async storeSecret(key: string, value: string): Promise<void> {
    await this._secretStorage.store(key, value);
  }

  /**
   * Retrieve a securely stored credential.
   * @param key The key the secret is stored under
   * @returns The secret value, or undefined if not set
   */
  async getSecret(key: string): Promise<string | undefined> {
    return await this._secretStorage.get(key);
  }
}
