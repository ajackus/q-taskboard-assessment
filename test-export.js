const { PrismaClient } = require('@prisma/client');
const Airtable = require('airtable');
require('dotenv').config();

const prisma = new PrismaClient();
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

async function run() {
  console.log("Fetching tasks from DB...");
  const tasks = await prisma.task.findMany({ include: { assignee: true } });
  console.log(`Found ${tasks.length} tasks.`);
  
  if (tasks.length === 0) return;
  
  console.log("Exporting to Airtable...");
  const table = base('Tasks');
  
  for (const task of tasks) {
    const fields = {
      "Task ID": task.id,
      "Title": task.title,
      "Description": task.description || "",
      "Status": task.status,
      "Assignee": task.assignee ? task.assignee.name : "Unassigned"
    };
    
    const existing = await table.select({ filterByFormula: `{Task ID} = '${task.id}'`, maxRecords: 1 }).firstPage();
    if (existing.length > 0) {
      await table.update(existing[0].id, fields);
      console.log(`Updated ${task.id}`);
    } else {
      await table.create(fields);
      console.log(`Created ${task.id}`);
    }
  }
  console.log("Done exporting.");
}

run().catch(console.error).finally(() => prisma.$disconnect());
