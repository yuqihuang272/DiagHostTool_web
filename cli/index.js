#!/usr/bin/env node

/**
 * comtest-cli - CVTE Device Serial Port Testing CLI
 *
 * Usage:
 *   comtest-cli list-ports
 *   comtest-cli -p /dev/ttyUSB0 get checksum
 *   comtest-cli -p COM3 set source hdmi1
 *   comtest-cli -p /dev/ttyUSB0 test wifi
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SerialClient } from './serialClient.js';
import {
  executeCommand,
  getAvailableCommands,
  formatResult,
  formatResultJson,
} from './commands.js';

const program = new Command();

program
  .name('comtest-cli')
  .description('CVTE device serial port testing CLI')
  .version('1.0.0')
  .option('-p, --port <path>', 'serial port path')
  .option('-b, --baud <rate>', 'baud rate', '115200')
  .option('-t, --timeout <ms>', 'response timeout in milliseconds', '3000')
  .option('-j, --json', 'output in JSON format')
  .option('--debug', 'enable debug output');

// list-ports command
program
  .command('list-ports')
  .description('List available serial ports')
  .action(async () => {
    try {
      const ports = await SerialClient.listPorts();

      if (ports.length === 0) {
        console.log('No serial ports found.');
        return;
      }

      if (program.opts().json) {
        console.log(JSON.stringify(ports, null, 2));
        return;
      }

      console.log('Available serial ports:\n');
      for (const port of ports) {
        console.log(`  ${chalk.green(port.path)}`);
        if (port.manufacturer) {
          console.log(`    Manufacturer: ${port.manufacturer}`);
        }
        if (port.serialNumber) {
          console.log(`    Serial Number: ${port.serialNumber}`);
        }
        if (port.pnpId) {
          console.log(`    PNP ID: ${port.pnpId}`);
        }
        console.log();
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// get command
program
  .command('get <item>')
  .description('Get device info (checksum, ip, mac, source, wifi, bluetooth)')
  .action(async (item) => {
    const options = program.opts();

    if (!options.port) {
      console.error(chalk.red('Error: Serial port is required. Use -p or --port option.'));
      process.exit(1);
    }

    const result = await executeCommand(
      options.port,
      parseInt(options.baud),
      'get',
      item.toLowerCase(),
      null,
      parseInt(options.timeout)
    );

    if (options.json) {
      console.log(formatResultJson(result));
    } else {
      if (result.success) {
        const { getCommandConfig } = await import('./commands.js');
        const config = getCommandConfig('get', item.toLowerCase());
        console.log(`${chalk.green('✓')} ${formatResult(result.data, config)}`);
      } else {
        console.log(`${chalk.red('✗')} Error: ${result.error}`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

// set command
program
  .command('set <type> <value>')
  .description('Set device parameter (e.g., set source hdmi1)')
  .action(async (type, value) => {
    const options = program.opts();

    if (!options.port) {
      console.error(chalk.red('Error: Serial port is required. Use -p or --port option.'));
      process.exit(1);
    }

    const result = await executeCommand(
      options.port,
      parseInt(options.baud),
      'set',
      type.toLowerCase(),
      value,
      parseInt(options.timeout)
    );

    if (options.json) {
      console.log(formatResultJson(result));
    } else {
      if (result.success) {
        console.log(`${chalk.green('✓')} ${type} set to ${value}`);
      } else {
        console.log(`${chalk.red('✗')} Error: ${result.error}`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

// test command
program
  .command('test <type>')
  .description('Run device test (wifi, bluetooth)')
  .action(async (type) => {
    const options = program.opts();

    if (!options.port) {
      console.error(chalk.red('Error: Serial port is required. Use -p or --port option.'));
      process.exit(1);
    }

    const result = await executeCommand(
      options.port,
      parseInt(options.baud),
      'test',
      type.toLowerCase(),
      null,
      parseInt(options.timeout)
    );

    if (options.json) {
      console.log(formatResultJson(result));
    } else {
      if (result.success) {
        const { getCommandConfig } = await import('./commands.js');
        const config = getCommandConfig('test', type.toLowerCase());
        console.log(`${chalk.green('✓')} ${formatResult(result.data, config)}`);
      } else {
        console.log(`${chalk.red('✗')} Error: ${result.error}`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

// help command to show available commands
program
  .command('commands')
  .description('Show available commands')
  .action(() => {
    const commands = getAvailableCommands();
    console.log('Available commands:\n');

    console.log(chalk.cyan('Get commands:'));
    commands.get.forEach((cmd) => console.log(`  get ${cmd}`));
    console.log();

    console.log(chalk.cyan('Set commands:'));
    console.log('  set source <name>');
    console.log(chalk.gray('  Valid sources: atv, dtv, hdmi1, hdmi2, vga, av1, av2, usb1, usb2'));
    console.log();

    console.log(chalk.cyan('Test commands:'));
    commands.test.forEach((cmd) => console.log(`  test ${cmd}`));
  });

// Parse arguments
program.parse();
