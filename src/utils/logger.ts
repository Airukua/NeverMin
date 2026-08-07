import * as vscode from 'vscode';
import { appendActivity } from './activityLog';

export class Logger {
  private static channel: vscode.OutputChannel | undefined;

  static init(channel: vscode.OutputChannel): void {
    Logger.channel = channel;
  }

  static show(): void {
    Logger.channel?.show(true);
  }

  static info(message: string): void {
    Logger.channel?.appendLine(`[INFO] ${message}`);
    appendActivity('info', message);
  }

  static warn(message: string): void {
    Logger.channel?.appendLine(`[WARN] ${message}`);
    appendActivity('warn', message);
  }

  static error(message: string): void {
    Logger.channel?.appendLine(`[ERROR] ${message}`);
    appendActivity('error', message);
  }
}
