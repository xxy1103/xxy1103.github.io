---
title: "git使用"
date: "2024-07-10T14:45:56+08:00"
categories:
  - "未分类"
tags:
  - "git"
---

# [git](https://git-scm.com/)的官方网站

## 首次使用Git

1.设置用户名

```
git config --global user.name <_name>       #设置用户名
git config --global user.email <_mail.com>  #设置用户邮箱
```

以我的电脑为例，我的电脑登录用户名为XXY，则可在 `C:\Users\XXY\.gitconfig` 文件中查看自己的用户配置

## Git提交到本地仓库

1. 初始化本地仓库
   在创建好的项目文件夹下通过git bush 输入以下命令初始化仓库

```
git init
```

此时会在此文件夹下创建一个名为 `.git`的隐藏文件夹，即仓库初始化成功
2. 查看仓库状态

```
git status
```

3. 将文件添加到暂存区

```
git add <_file_name1> <_file_name2> ... #将文件添加到暂存区
git add <_dir_name>                     #将文件夹添加到暂存区
git add --all                           #将所有的改动过的文件提交到缓存区
git add .                               #将目录下的所有文件添加到暂存区
```

4. 将文件提交到本地仓库([git commit](https://www.runoob.com/git/git-commit.html))

```
git commit -m "日志信息" 
git commit <_file_name1> <_file_name2> ... -m "日志信息"    #提交暂存区内的部分文件
git commit -a   #无需执行git add,直接提交
```

注意：对于第一提交的文件，都需要先使用 `git add` 再使用 `git commit`提交至仓库中，后续对文件进行修改过后，可以通过 `git commit -am "日志信息"`来简化操作流程

## Git版本回滚

1. 查看历史记录

```
git reflog  #较简洁
git log     #较详细
```

2. 版本穿梭[git reset](https://www.runoob.com/git/git-reset.html)
   在Git中，git reset 是一个用于撤销提交、回溯版本和调整工作目录或暂存区状态的强大命令。它主要有三种模式：--soft、--mixed 和 --hard，每种模式对应不同的操作。其基本语法如下：
   `git reset [--mixed | --soft | --hard | --merge | --keep] [commit]`
   1. --mixed 或不带选项（默认）：移动 HEAD 指针并重置索引，不会修改工作区，撤销了提交和暂存的更改，但保留了工作区的修改。
   2. --soft: 只移动HEAD指针，暂存区和工作目录中的更改都会保留在工作目录中，以便再次提交。
   3. --hard: 移动 HEAD 指针并重置索引和工作区，彻底删除了提交以及暂存区和工作区的修改，**慎用**，因为会导致工作区的内容**丢失**。
   4. --merge 和 --keep：较少常用，适用于特殊场景，前者尝试将HEAD指向的提交与指定提交之间的差异应用到当前工作目录，后者类似mixed，但保留未修改的文件。

[soft mixed hard 区别以及reset用法](https://segmentfault.com/a/1190000044719020)

```
git reset [] HEAD^ #回退到上一版本（所有内容）
git reset [] HEAD^ test.txt    #将指定文件回退到上一版本
git  reset [] <_版本号>    #回退到指定版本
```

HEAD 说明：

HEAD 表示当前版本

HEAD^ 上一个版本

HEAD^^ 上上一个版本

HEAD^^^ 上上上一个版本

以此类推...

可以使用 ～数字表示
HEAD~0 表示当前版本

HEAD~1 上一个版本

HEAD^2 上上一个版本

HEAD^3 上上上一个版本

以此类推...

## Git分支操作

1. 创建分支
   创建分支相当于把主分支复制一份，在分支上编辑不影响主分支

```
git branch <_name>
```

2. 切换分支

```
git checkout <_name>    #切换到已有的分支
git checkout -b <_name> #创建一个分支并立即切换到此分支
```

3. 查看当前分支

```
git branch -v   #查看分支
```

![创建分支][img1]
其中，*表示目前所在的分区
4. 删除分支

```
git branch -d <_name>
```

5. 合并分支
   首先切换到你需要合并的分支，假设你要将b_test 分支合并到master分支。

```
git checkout master #切换到master分支

git merge b_test    #将b_test合并到当前所在分支（b_test不受影响)
```

在没有合并冲突的情况下，合并分支更像是将b_test分支直接拷贝到master分支下。
例如：master内容如下:
![master文件][img2]
b_test分支内容如下：
![b_test文件][img3]

合并过后会将test2.txt文件删除，复制python.py文件。text.txt文件内容与分支保持一至

## 合并冲突

当合并的两个分支中有冲突的部分时，会出现合并冲突。
Git会将冲突文件以下图方式展示出来，我们需要手动修改冲突部分。
![合并冲突][img4]
修改完成后需要重新 `git add` `git commit`冲突的文件
![合并冲突解决][img5]
即可恢复正常

## Git与远程仓库

1. 添加远程库
   要添加一个新的远程仓库，可以指定一个简单的名字，以便将来引用,命令格式如下：

```
git remote add <_name> <_url>
```

2. 将本地分支推送到服务器

```
git push origin(远程库名) master(分支名)
```

3. 拉取云端代码到本地

```
git pull origin(远程库名) master(分支名)
```

4. git fetch 与git pull
   `git fetch`是将远程主机的最新内容拉到本地，用户在检查了以后决定是否合并到工作本机分支中。而 `git pull` 则是将远程主机的最新内容拉下来后直接合并，即：`git pull = git fetch + git merge`，这样可能会产生冲突，需要手动解决。

[img5]: /image/git使用/img5.png
[img4]: /image/git使用/img4.png
[img3]: /image/git使用/img3.png
[img2]: /image/git使用/img2.png
[img1]: /image/git使用/img1.jpg

