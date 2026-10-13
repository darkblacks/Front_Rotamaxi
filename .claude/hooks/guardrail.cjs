
'use strict';

/**
 * RotaMaxi Team V2
 *
 * Custom guardrail disabled by project owner.
 *
 * This hook no longer blocks:
 * - SSH, SCP, SFTP or AWS commands
 * - Remote Laravel development
 * - Local frontend/backend editing
 * - Git and deployment commands
 * - Database commands
 * - Configuration file editing
 *
 * Standard Claude Code permissions and AWS
 * access controls still apply.
 */

process.stdin.setEncoding('utf8');
process.stdin.resume();

process.stdin.on('end', () => {
  // Exit successfully without denying any tool operation.
  process.exitCode = 0;
});
