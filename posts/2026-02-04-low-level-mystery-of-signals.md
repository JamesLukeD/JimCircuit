---
title: The Low Level Mystery of Signals
slug: low-level-mystery-of-signals
date: 2026-02-04
summary: Uncover the low-level abstraction behind shortcuts like CTRL+Z and
  CTRL+C - the mysterious world of Linux signals.
tags:
  - Linux
  - Terminal
  - Systems
keywords:
  - linux signals
  - SIGTERM
  - SIGSTOP
  - kill command
  - ctrl+z
  - ctrl+c
  - process management
---

Sometimes shortcuts such as CTRL+Z or CTRL+C seem like a mystery. Even the command kill. But beneath these commands and shortcuts, there's actually a bit of low level abstraction which works in the background. This concept is known as signals. For example, the signal for the kill command is actually defaulted at 15, which stands for SIGTERM which means "Signal Terminate" which is why when we get the "Terminated" output when we kill a process.

```shell
sleep 60 &
[1] 6137
jobs
[1]+  Running                 sleep 60 &
kill 6137
[1]+  Terminated              sleep 60
```

In this example we can see sleep 60 has been added to the process 6137 with the job allocation of [1]. The jobs option shows us that we have this job running in the background which was initialised in the background using the "&" operator.

We then kill this process using the process number allocated and clicking "ENTER" gives us the update [1]+ Terminated. This has now used the SIGTERM protocol to remove this from our jobs list.

We can access the list of signals using the "kill -l" list which goes through 64 signals which are available to us. The interesting thing about signals. For example with the "CTRL+Z" this command allows us to stop a signal using 19, SIGSTOP. We can then change the way the kill option handles the data. So we can use the option

```shell
kill -SIGSTOP 6197
[1]+  Stopped                 sleep 60
```

As you can see now the output has changed to "Stopped" which means that the way the data has been handled has changed from SIGTERM to SIGSTOP creating the same methodology as the way CTRL+Z handles the processes.

There are many signals to explore and discover, so check it out for yourself but this is an example of how the lower level abstraction for signals works — a great way to expose and learn more about how the systems work and interact within the Linux shell.
