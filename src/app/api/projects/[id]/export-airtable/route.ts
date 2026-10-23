import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  getProjectMembership,
} from "@/lib/auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(
  req: NextRequest,
  { params }: Params
) {
  const user = await getCurrentUser(req);

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const membership =
    await getProjectMembership(
      user.id,
      id
    );

  if (!membership) {
    return forbidden(
      "you are not a member of this project"
    );
  }

  if (membership.role === "viewer") {
    return forbidden(
      "viewers cannot export tasks"
    );
  }

  const tasks =
    await prisma.task.findMany({
      where: {
        projectId: id,
      },
      include: {
        assignee: true,
      },
    });

  const base = new Airtable({
    apiKey:
      process.env.AIRTABLE_TOKEN!,
  }).base(
    process.env.AIRTABLE_BASE_ID!
  );

  let exported = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const existing =
        await base(
          process.env
            .AIRTABLE_TABLE_NAME!
        )
          .select({
            filterByFormula:
              `{TaskId}="${task.id}"`,
          })
          .firstPage();

      const fields = {
        TaskId: task.id,
        Title: task.title,
        Description:
          task.description ?? "",
        Status: task.status,
        Assignee:
          task.assignee?.name ??
          "",
      };

      if (existing.length > 0) {
        await base(
          process.env
            .AIRTABLE_TABLE_NAME!
        ).update(
          existing[0].id,
          fields
        );
      } else {
        await base(
          process.env
            .AIRTABLE_TABLE_NAME!
        ).create(fields);
      }

      exported++;
    } catch (error) {
      console.error(error);
      failed++;
    }
  }

  return NextResponse.json({
    exported,
    failed,
  });
}