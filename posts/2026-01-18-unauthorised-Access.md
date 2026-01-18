# Understanding UIDs and Root Access: Permission Denied

## Video

- https://www.youtube.com/shorts/SmrlJrirxYg

Have you ever tried to open a file in Linux and saw the "Permission Denied" message? It’s because Linux uses your user identity to secure important parts of the system. Understanding how Linux manages these permissions helps you understand why you see this message.

## The Power of the "Root" User

In Ubuntu and similar systems, every user gets a specific access level.

When you make a new account, Linux gives you a unique User ID (UID) that usually starts at 1000. This UID helps Linux decide what files and commands you can use. Regular users have limited access to keep the system safe.

The root user, UID 0, can change any file.

## The ID Command, Who Are You?

To find out why you're blocked, see how the system identifies you by using the id command:

UID: User Identifier
GID: Group Identifier

Linux stores this info in /etc/passwd (users) and /etc/group (groups). Find your entry with: grep 'yourusername' /etc/passwd

## Case Study: The /etc/shadow File

/etc/shadow is one example of a file with restricted access. Its used to store encrypted passwords, so a regular user cannot see or change them

Run ls -l /etc/shadow to check permissions. You’ll usually see: -rw-r----- 1 root shadow.

Here’s what those permissions mean:

Owner (Root): Has Read and Write access.
Group (Shadow): Read access.
Everyone else: No privileges.

For regular users (UID 1000, not in root or shadow), you will not be able to access the file. This keeps your system secure.

## Conclusion

So, the next time you see "Permission Denied," just remember that Linux is protecting your crucial system data. It’s designed this way to keep your system safe from unwanted changes. If you must gain access, use sudo or switch to the root user carefully. As Slughorn says in Harry Potter, “Use it well.”
