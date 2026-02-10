---
title: 	"c++ 模板"
date: 2024-08-5 12:13:56
tags: "c++"
---

# 函数模板

```
template <typename type> ret-type func-name(parameter list)
{
   // 函数的主体
}
```

以数组求和的函数为例，一般我们在对整型数组求和时，以下为一个常见的求和函数：
```
int sum (int *begin, int*end)
{
    int ans = 0;
    for(int* p = begin;p!=end;p++)
    {
        ans += *p;
    }
    return ans;
}
```
若想对sum函数进行改造，使其可以对于任意一个类型的数组进行求和，就需要使用模板。
使用模板改造sum函数如下：
```
template <typename T>
T sum (T *begin, T *end)
{
    T ans = 0;
    for(T* p = begin;p != end;p++)
    {
        ans += *p;
    }
    return ans;
}
注意：当类型为自定义结构体或类时，应该先定义结构体`+` ，`-`等操作。
```
# 结构体模板
```
template <typename type> struct <_name>
{
    //结构体内容
}
```

同样，我们以一个例子来看一下，我们自定义一个Point结构体：
```
template <typename T>
struct Point{
    T x,y;
    Point(T x=0,T y=0):x(x),y(y){}
};
```

Point结构体的使用：
```
#include<iostream>
using namespace std;
template <typename T>
T sum (T *begin, T *end)
{
    T ans = 0;
    for(T* p = begin;p != end;p++)
    {
        ans =ans + *p;
    }
    return ans;
}
template <typename T>
struct Point{
    T x,y;
    Point(T x=0,T y=0):x(x),y(y){}
};
template <typename T>
Point<T> operator + (Point<T> A,Point<T> B){
    return Point(A.x+B.x,A.y+B.y);
}

template <typename T>
ostream& operator << (ostream &out,Point<T> p){
    out<<"("<<p.x<<","<<p.y<<")";
    return out;
}
int main() {
    Point<int> a(1,1);
    Point<int> b(2,2);
    Point<double> c(2.4,2.5);
    Point<double> d(2.3,2.4);
    cout<<(a+b)<< (c+d) <<endl;
    return 0;
}
```