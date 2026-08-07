import Module from 'module';
import path from 'path';

const mockPath = path.join(__dirname, 'vscode.js');
const originalRequire = Module.prototype.require;

Module.prototype.require = function patchedRequire(this: NodeModule, id: string): unknown {
  if (id === 'vscode') {
    return originalRequire.call(this, mockPath);
  }
  return originalRequire.call(this, id);
} as typeof Module.prototype.require;
