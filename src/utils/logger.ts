import * as vscode from 'vscode';

export class Logger {
  private static channel: vscode.OutputChannel;

  static init(channel: vscode.OutputChannel): void {
    Logger.channel = channel;
  }

  static info(message: string): void {
    Logger.channel?.appendLine(`[INFO] ${message}`);
  }

  static warn(message: string): void {
    Logger.channel?.appendLine(`[WARN] ${message}`);
  }

  static error(message: string): void {
    Logger.channel?.appendLine(`[ERROR] ${message}`);
  }
}
