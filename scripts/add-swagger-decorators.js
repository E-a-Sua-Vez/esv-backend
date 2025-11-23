/**
 * Script to help identify which controllers need Swagger decorators
 * This is a reference script - actual decorators should be added manually
 * to ensure proper documentation
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../src');
const controllers = [];

function findControllers(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findControllers(filePath);
    } else if (file.endsWith('.controller.ts')) {
      controllers.push(filePath);
    }
  });
}

findControllers(controllersDir);

console.log('Found controllers:');
controllers.forEach(ctrl => {
  console.log(`- ${path.relative(process.cwd(), ctrl)}`);
});

console.log(`\nTotal: ${controllers.length} controllers`);

