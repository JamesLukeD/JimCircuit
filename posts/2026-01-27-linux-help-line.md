# The Linux Help Line: Understanding --help, man, and type

## Video

- https://www.youtube.com/shorts/n6DEwUiFL-0

There will come a time in all of our Linux journeys where we can't seem to remember or would perhaps like to discover new options for the command we are using.

Lucky for us, there are a few ways we can explore and better understand these commands.

## Built-in Commands

Now, you may have heard of built-in commands or maybe you haven’t. These are commands which are directly built into the shell. Accessing these commands can be slightly different from for example aliased commands and knowing the difference not only helps you with comprehension and a deeper understanding for the terminal but its just nice to know.

These commands are typically things like cd or pwd for example. To figure out which is a built-in or not you can use the command 

```shell
daggy@JimCircuit:~$ type cd
cd is a shell builtin
```

Now to access this specific type of command we have:

```shell
daggy@JimCircuit:~$ cd --help
```

## Alias Commands

Similarly we can also find commands which are aliased. These are command shortcuts defined in shell configuration files, usually in the user’s home directory (like `~/.bashrc`)

```shell
daggy@JimCircuit:~$ cat /home/daggy/.bashrc
```

These commands are typically things like _ls_ or _grep_ in this example we can see `ls` is aliased with its colour set to auto, which gives it all the colours when you list the files. (Yes, this is intentional!)

Note: Even though `ls` is a binary, many systems ship with an alias that adds helpful defaults like colour.

```shell
daggy@JimCircuit:~$ type ls
ls is aliased to `ls --color=auto'
```

Now typically when we want to open the help guide in this instance we will use a command called _man_ which opens the help guide into a pager called _less_. We can then use the down arrow to look at the options. As shown in the example below.

```shell
daggy@JimCircuit:~$ man ls
```

```shell
LS(1)                            User Commands                           LS(1)

NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION]... [FILE]...

DESCRIPTION
       List  information  about  the FILEs (the current directory by default).
       Sort entries alphabetically if none of -cftuvSUX nor --sort  is  speci‐
       fied.

       Mandatory  arguments  to  long  options are mandatory for short options
       too.

       -a, --all
              do not ignore entries starting with .

       -A, --almost-all
              do not list implied . and ..

       --author

```

To exit this view you will need to click the command 'q' for quit.

Alternatively, you can also use the same commands as the shell built-in for alias commands

```shell
ls --help
```

Which opens this up outside of a pager inside of the terminal view.

```shell
daggy@JimCircuit:~$ ls --help
Usage: ls [OPTION]... [FILE]...
List information about the FILEs (the current directory by default).
Sort entries alphabetically if none of -cftuvSUX nor --sort is specified.

Mandatory arguments to long options are mandatory for short options too.
  -a, --all                  do not ignore entries starting with .
  -A, --almost-all           do not list implied . and ..
      --author               with -l, print the author of each file
  -b, --escape               print C-style escapes for nongraphic characters
      --block-size=SIZE      with -l, scale sizes by SIZE when printing them;
                             e.g., '--block-size=M'; see SIZE format below

  -B, --ignore-backups       do not list implied entries ending with ~
  -c                         with -lt: sort by, and show, ctime (time of last

```

## Binary Commands

Now, we also have commands which live inside of the _/usr/bin_ directory for binaries. These are typically commands which allow file manipulation, system repair and shell interaction.

Identically, like the aliased commands you can use both _man_ and _--help_ to access the help file of these commands. Just remember if you want to understand the type of the commands just specify the command _type_ with the command you would like to view.

```shell
daggy@JimCircuit:~$ type cp
cp is /usr/bin/cp
```

## Conclusion

Understanding whether a command is built-in, aliased, or binary is a great way to understand why commands behave in certain ways. When in doubt, `type` is your best friend. With the commands `--help` and `man`, you'll be right on your way to mastering every command you encounter.
