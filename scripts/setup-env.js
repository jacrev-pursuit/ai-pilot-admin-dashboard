#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script helps set up environment variables for different environments.
 * It copies the appropriate .env.example file to a new .env file.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get the environment from command line arguments or prompt the user
const getEnvironment = () => {
  const args = process.argv.slice(2);
  const envArg = args.find(arg => arg.startsWith('--env='));
  
  if (envArg) {
    return envArg.split('=')[1];
  }
  
  return new Promise((resolve) => {
    rl.question('Which environment are you setting up? (development/production/test): ', (answer) => {
      resolve(answer.toLowerCase());
    });
  });
};

// Copy the example file to the target file
const copyEnvFile = (sourceFile, targetFile) => {
  try {
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
      console.error(`Error: ${sourceFile} does not exist.`);
      process.exit(1);
    }
    
    // Check if target file already exists
    if (fs.existsSync(targetFile)) {
      rl.question(`${targetFile} already exists. Do you want to overwrite it? (y/n): `, (answer) => {
        if (answer.toLowerCase() === 'y') {
          performCopy(sourceFile, targetFile);
        } else {
          console.log('Operation cancelled.');
          rl.close();
        }
      });
    } else {
      performCopy(sourceFile, targetFile);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const performCopy = (sourceFile, targetFile) => {
  try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Successfully created ${targetFile} from ${sourceFile}`);
    console.log(`\nIMPORTANT: Edit ${targetFile} with your actual credentials.`);
    console.log('Never commit this file to version control!');
    rl.close();
  } catch (error) {
    console.error(`Error copying file: ${error.message}`);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  const env = await getEnvironment();
  
  if (!['development', 'production', 'test'].includes(env)) {
    console.error('Invalid environment. Must be development, production, or test.');
    process.exit(1);
  }
  
  const sourceFile = path.join(__dirname, '..', '.env.example');
  const targetFile = path.join(__dirname, '..', env === 'development' ? '.env' : `.env.${env}`);
  
  copyEnvFile(sourceFile, targetFile);
};

main(); 