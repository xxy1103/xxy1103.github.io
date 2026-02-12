---
title: linux 简单操作命令集合
date: 2024-07-05 20:44:41
tags: "Linux"
---
## 文件夹相关

1. 罗列当前目录下文件

```
ls
```

2. 显示当前工作目录路径

```
pwd
```

3. 切换工作目录/打开文件夹

```
cd <路径>/<_name>
```

4. 创建文件夹

```
mkdir <_name>
```

5. 删除文件夹/文件(包括其中的内容)

```
rm -f <_name>
rm -rf <_dir>   #-r（参数表示递归删除目录及其内容）
                #-f（参数表示强制删除）
```

6. 复制文件夹/文件

```
cp <source_file> <destination>
cp -r <source_dir> <destination>
```

7. 返回上级目录：

   ```
   cd ..
   ```
8. 文件夹重命名

   ```bash
   mv <old_folder> <new_folder>
   ```

## 应用/应用

1. 执行权限：

   ```bash
   chmod +x <name>		//赋予
   chmod -x <name>		//去除
   ```

### systemctl

**systemctl** 是 Linux 系统中用于管理 systemd 系统和服务的命令行工具。

1. 启动、停止、重启服务

   ```
   systemctl start <name>
   systemctl stop <name>
   systemctl restart <name>
   ```
2. 查看服务状态

   ```
   systemctl status <name>
   systemctl is-active <name>
   ```
3. 设置服务开机自启动

   ```
   systemctl enable <name>
   ststemctl disable <name>
   ```

## 进程相关

1. 查看所有进程

```
ps aux
```

2. 杀死进程

```
kill <process_id>
killall <server_name>	//杀死该服务的所有进程
```

## 网络相关

1. 查看网络信息

```
ifconfig
```

2.从网络下载文件

```
wget <_URL>
curl -O <_URL>
```

3. ssh连接

```
ssh <_username>@<ip> -p <port>
```

## 解压缩

```
tar -czvf <_name>.tar.gz <_directory_name>  # 压缩目录
tar -xzvf <_name>.tar.gz  # 解压文件
```

## 用户相关

1. 超级用户

```
sudo <_order>
sudo su #切换至超级用户
```

2. 更改密码

```
passwd <_username>
passwd  #更改当前用户密码
```

3. 查看用户名

```
who
whoami #termux中
```

4. 更改文件所有用户

   ```bash
   chown [选项]... [所有者][:所属组] 文件...
   ```

* **`所有者` (owner)** ：要将文件或目录的所有权修改为的用户名称或用户 ID。
* **`所属组` (group)** ：要将文件或目录的所属组修改为的组名称或组 ID。
* **`文件...` (file...)** ：要修改所有权的一个或多个文件或目录。

**常用选项**

* **`-c` 或 `--changes`** : 只显示实际更改的文件或目录。
* **`-f` 或 `--silent` 或 `--quiet`** : 禁止显示错误信息。
* **`-h` 或 `--no-dereference`** : 不修改符号链接指向的文件，而是修改符号链接本身的所有权。
* **`-v` 或 `--verbose`** : 显示详细的操作信息。
* **`-R` 或 `--recursive`** : 递归地修改目录及其子目录和文件的所有权。
* **`--from=当前所有者[:当前所属组]`** : 只修改匹配指定当前所有者和/或所属组的文件或目录的所有权。

**使用示例**

1. **修改文件所有者:**

   ```bash
   chown user1 myfile.txt
   ```
   将 `myfile.txt` 的所有者修改为 `user1`。
2. **修改文件所属组:**

   ```bash
   chown :group1 myfile.txt
   ```
   将 `myfile.txt` 的所属组修改为 `group1`。
3. **修改文件所有者和所属组:**

   ```bash
   chown user1:group1 myfile.txt
   ```
   将 `myfile.txt` 的所有者修改为 `user1`，所属组修改为 `group1`。
4. **递归修改目录所有权:**

   ```bash
   chown -R user1:group1 mydir
   ```
   递归地将 `mydir` 目录及其所有子目录和文件的所有者修改为 `user1`，所属组修改为 `group1`。
