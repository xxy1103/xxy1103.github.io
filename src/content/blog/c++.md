---
title: c++基础
date: 2024-07-13 22:13:56
tags: "c++"
---
# [c++命名空间](https://www.runoob.com/cplusplus/cpp-namespaces.html)

命名空间可以实现对同一个名字的函数多次定义，并且在使用时，可以通过命名空间来指定使用的哪一个函数。

## 定义命名空间

```
namespace <_name1> {
   void function(){
   //代码实现
   }
}
namespace <_name2> {
   void function(){
   //代码实现
   }
}
```

使用时，通过 `<_name>::function()`来使用在1或2中定义的function()函数。

## using指令

通过使用 `using namespace <_name>`指令来告诉计算机后续的代码将使用哪个命名空间中的函数，这样在后续的代码中，就可以省略namespace的名称，直接使用函数的名字。

```
#include `<iostream>`
using namespace std;
// 第一个命名空间
namespace first_space{
   void func(){
      cout << "Inside first_space" << endl;
   }
}
// 第二个命名空间
namespace second_space{
   void func(){
      cout << "Inside second_space" << endl;
   }
}
using namespace first_space;
int main ()
{

   // 调用第一个命名空间中的函数
   func();

   return 0;
}
```

# [数据类型](https://www.runoob.com/cplusplus/cpp-data-types.html)

# 基本的输入输出

对于输入输入输出常用的头文件有[iostream](https://www.runoob.com/cplusplus/cpp-libs-iostream.html)，[iomanip](https://www.runoob.com/cplusplus/cpp-libs-iomanip.html)，[fstream](https://www.runoob.com/cplusplus/cpp-libs-fstream.html)

## 标准输出流（cout）

预定义的对象 cout 是 iostream 类的一个实例。cout 对象"连接"到标准输出设备，通常是显示屏。cout 是与流插入运算符 << 结合使用的，如下所示：

```
#include `<iostream>`

using namespace std; # 声明函数空间

int main()
{
   char str[] = "Hello C++";

   cout << "Value of str is : " << str << endl;
}
```

代码运行结果如下：`Value of str is : Hello C++`。
C++ 编译器根据要输出变量的数据类型，自动选择合适的流插入运算符来显示值。<< 运算符被重载来输出内置类型（整型、浮点型、double 型、字符串和指针）的数据项。
流插入运算符 << 在一个语句中可以多次使用，如上面实例中所示，endl 用于在行末添加一个换行符。

## 标准输入流（cin）

预定义的对象 cin 是 iostream 类的一个实例。cin 对象附属到标准输入设备，通常是键盘。cin 是与流提取运算符 >> 结合使用的，如下所示：



```cpp

#include `<iostream>`

using namespace std;

int main( )
{
   char name[50];
   int age;
   cout << "请输入您的名称和年龄： ";
   cin >> name >> age;
   cout << "您的名称是： " << name << "\n" << "您的年龄是： " << age << endl;

}
```

C++ 编译器根据要输入值的数据类型，选择合适的流提取运算符来提取值，并把它存储在给定的变量中,并且流提取运算符 >> 在一个语句中可以多次使用
`cin >> name >> age;`和下列写法等效

```c++
cin >> name;
cin >> age;
```

如果希望一次读取一行的内容，可以使用cin.getline()函数

```
cin.getline(char*, size_t)
```

第一个参数为存放内容的字符串数组，第二个参数为数组能存放的最大大小。

# [字符串](https://www.runoob.com/cplusplus/cpp-strings.html)

## c风格字符串

## string类

首先，使用string类需要引用 `#include<string>`，`#include <iostream>`这两个头文件，string类是std命名空间中的一个类，所以使用时完全写法为 `std::string <_name>`,它是对 C 风格字符串的封装，提供了更安全、更易用的字符串操作功能。

```
#include `<iostream>`
#include `<string>`

using namespace std;

int main ()
{
   string str1 = "runoob";
   string str2 = "google";
   string str3;
   int  len ;

   // 复制 str1 到 str3
   str3 = str1;
   cout << "str3 : " << str3 << endl;

   // 连接 str1 和 str2
   str3 = str1 + str2;
   cout << "str1 + str2 : " << str3 << endl;

   // 连接后，str3 的总长度
   len = str3.size();
   cout << "str3.size() :  " << len << endl;

   return 0;
}
```

### 常用成员函数

std::string 类提供了许多成员函数来操作字符串，以下是一些常用的成员函数：

1. size(): 返回字符串的长度
2. empty(): 检查字符串是否为空，返回一个bool值
3. operator[num]: 通过索引访问字符串中的内容
4. subsrt(num1,num2): 获取从下标num1开始的num2个连续字符构成的子字符串
5. find(string): 查找子字符串在主字符串中的位置,返回第一个字符的下标
6. replace(): 替换字符串中的某些字符
   ```cpp
   #include <iostream>
   #include <string>

   int main() {
       // 声明并初始化字符串
       std::string greeting = "Hello, World!";
       std::cout << "Greeting: " << greeting << std::endl;

       // 使用 size() 获取字符串长度
       std::cout << "Length of the greeting: " << greeting.size() << std::endl;

       // 使用 empty() 检查字符串是否为空
       std::cout << "Is the greeting empty? " << (greeting.empty() ? "Yes" : "No") << std::endl;

       // 使用 operator[] 访问特定位置的字符
       std::cout << "Character at position 7: " << greeting[7] << std::endl;

       // 使用 substr() 获取子字符串
       std::string sub = greeting.substr(7, 5);
       std::cout << "Substring from position 7 with length 5: " << sub << std::endl;

       // 使用 find() 查找子字符串
       std::cout << "Position of 'World' in the greeting: " << greeting.find("World") << std::endl;

       // 使用 replace() 替换字符串中的字符
       std::string modified = greeting.replace(7,5,"C++");
       std::cout << "Modified greeting: " << modified << std::endl;

       return 0;
   }
   ```

运行结果：

```
Greeting: Hello, World!
Length of the greeting: 13
Is the greeting empty? No
Character at position 7: W
Substring from position 7 with length 5: World
Position of 'World' in the greeting: 7
Modified greeting: Hello, C++!
```

# c++引用

引用相当于是给同一个内存地址取的别名，两个名字指向同一个地址空间。

## 引用与指针差别

引用很容易与指针混淆，它们之间有三个主要的不同：

1. 不存在空引用。引用必须连接到一块合法的内存。
2. 一旦引用被初始化为一个对象，就不能被指向到另一个对象。指针可以在任何时候指向到另一个对象。
3. 一旦引用被初始化为一个对象，就不能被指向到另一个对象。指针可以在任何时候指向到另一个对象。

## C++中创建引用

将变量名视为内存中一块地址的名字，则引用则可视为这个空间的第二名称，两个名字均可以找到这块地址并读取修改地址中的数据。
假设创建变量：

```
int i = 1;
double s = 5.2;
```

可以通过 `<_type>& <_name>`来创建引用：

```
int& r = 1;
double& d = 5.2;
```

在这些声明中，& 读作引用。因此，第一个声明可以读作 "r 是一个初始化为 i 的整型引用"，第二个声明可以读作 "s 是一个初始化为 d 的 double 型引用"。下面的实例使用了 int 和 double 引用：

```
#include 
```


运行结果如下：

```
Value of i : 4
Value of i reference : 4
0x5ffe4c
0x5ffe4c
Value of d : 11.7
Value of d reference : 11.7
0x5ffe40
0x5ffe40
```



引用变量r与i，d与s地址相同，仅仅是名字不同。

## 引用的作用

看完前面的内容你可能还是不明白引用究竟有何作用，我为何不直接直接使用变量的第一名称？

1. [把引用作为参数](https://www.runoob.com/cplusplus/passing-parameters-by-references.html)
   我们知道在c语言中，函数传参为形势参数，在函数中对于传入变量的修改并不影响原本变量的值，这是因为形参与实参的地址不同。可如果函数的参数为引用，则可以确保形参与实参地址相同，相比于传统的传址调用，使用引用可以更加安全与方便。

```cpp
#include `<iostream>`
   using namespace std;

// 函数声明
void swap(int& x, int& y);

int main ()
{
   // 局部变量声明
   int a = 100;
   int b = 200;

   cout << "交换前，a 的值：" << a << endl;
   cout << "交换前，b 的值：" << b << endl;

   /* 调用函数来交换值 */
   swap(a, b);

   cout << "交换后，a 的值：" << a << endl;
   cout << "交换后，b 的值：" << b << endl;

   return 0;
}

// 函数定义
void swap(int& x, int& y)
{
   int temp;
   temp = x; /* 保存地址 x 的值 */
   x = y;    /* 把 y 赋值给 x */
   y = temp; /* 把 x 赋值给 y  */

   return;
}
```


运行结果：

```
交换前，a 的值：100
交换前，b 的值：200
交换后，a 的值：200
交换后，b 的值：100
```

2. [把引用作为返回值](https://www.runoob.com/cplusplus/returning-values-by-reference.html)
在使用数组，链表等设计大量指针操作的内容时，使用引用为一个地址赋予名字可以使得c++程序更加容易阅读和维护。C++ 函数可以返回一个引用，方式与返回一个指针类似。
当函数返回一个引用时，则返回一个指向返回值的隐式指针。这样，函数就可以放在赋值语句的左边。例如，请看下面这个简单的程序：

```cpp
#include `<iostream>`

using namespace std;

double vals[] = {10.1, 12.6, 33.1, 24.1, 50.0};

double& setValues(int i) {
   double& ref = vals[i];
   return ref;   // 返回第 i 个元素的引用，ref 是一个引用变量，ref 引用 vals[i]

}

// 要调用上面定义函数的主函数
int main ()
{

   cout << "改变前的值" << endl;
   for ( int i = 0; i < 5; i++ )
   {
       cout << "vals[" << i << "] = ";
       cout << vals[i] << endl;
   }

   setValues(1) = 20.23; // 改变下标为1的元素
   setValues(3) = 70.8;  // 改变下标为3的元素

   cout << "改变后的值" << endl;
   for ( int i = 0; i < 5; i++ )
   {
       cout << "vals[" << i << "] = ";
       cout << vals[i] << endl;
   }
   return 0;
}
```


当返回一个引用时，要注意被引用的对象不能超出**作用域**。所以返回一个对局部变量的引用是不合法的，但是，可以返回一个对静态变量的引用。

```cpp
int& func() {
   int q;
   //! return q; // 在编译时发生错误
   static int x;
   return x;     // 安全，x 在函数作用域外依然是有效的
}
```
