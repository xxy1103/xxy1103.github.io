---
title: 	"c++ 结构体"
date: 2024-08-4 12:13:56
tags: "c++"
---

C++ 中的struct不在需要使用typedef，使用时可以直接使用结构体名字而无需在前面加`struct`,并且c++中的结构体除了可以拥有变量（成员变量）之外还可以拥有函数（成员函数）

```

struct Point {
    int x,y;
    Point(int x = 1,int y = 0):x(x),y(y){}// 等价于 Point(int x = 0,int y = 0){this->x = x;this->y = y;}
    int print() {
        cout <<"(" << this->x << ","<< this ->y << ")" << endl;
        return 0;
    }
};//C++中的函数参数可以拥有默认值

Point operator + (Point A,Point B){
    return Point(A.x+B.x,A.y+B.y);
}

int main() {
    Point a,b(1,2);
    (a+b).print();
    b.print();
    return 0;
}

```