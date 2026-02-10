---
title: 	"c++ set"
date: 2024-08-6 10:13:56
tags: "c++"
---
# set基本用法

C++ 标准库中的 `<set>` 是一个关联容器，它存储了一组唯一的元素，并按照一定的顺序（从小到大）进行排序。
在使用前，需要引头文件 `#include <set>`

声明set容器：
```
std::set<元素类型> 元素名;
```

常用操作：

```cpp
std::set `<int>` myset;

myset.insert(1);    //插入一个元素
myset.erase(2);     //删除一个元素
myset.find(3);      //查找一个元素
myset.size();       //返回容器中的元素数量
myset.empty();      //检查容器是否为空
```

## insert()

### 单个元素插入

insert(value)函数会返回一个pair第一个值为一个迭代器，第二个位置为一个布尔值。

1. 插入成功
   插入成功时，第一个迭代器会指向插入成功的元素所在的位置；第二个布尔值为true。
2. 插入失败
   插入失败是因为集合中已经有了相同的元素，所以第一个迭代器会返回相同元素的位置，第二个布尔值为false。

我们可以通过 `result.first`和 `result.second`来访问第一个和第二个参数。

```cpp
std::set<int> s;
auto result = s.insert(10);
if (result.second) {
    std::cout << "插入成功\n";
} else {
    std::cout << "元素已存在\n";
}
```

### 范围插入

insert(first,last)，接收两个迭代器first和last表示插入的范围 `[first, last)`，这两个迭代器可以来自任何符合标准的容器（如 `std::vector`、`std::list` 等）,此时它没有返回值。

```cpp
std::set<int> s;
std::vector<int> v = {1, 2, 3};
s.insert(v.begin(), v.end());

```

## erase()

### 通过值删除元素

通过set.erase(value)来删除集合中的元素，此时返回一个 `size_t`类型，表示删除的元素个数，即是否成功删除，1表示成功删除，0表示value不存在。

```cpp
std::set<int> s = {1, 2, 3};
size_t num_erased = s.erase(2);  // 如果元素 2 存在，返回 1，否则返回 0
std::cout << "删除了 " << num_erased << " 个元素" << std::endl;

```

### 范围删除

erase(first,last)，接收两个迭代器first和last表示删除的范围 `[first, last)`，会删除所有这些迭代器中的值，这两个迭代器可以来自任何符合标准的容器（如 `std::vector`、`std::list` 等）,此时它没有返回值。

```cpp
std::set<int> s = {1, 2, 3, 4, 5};
s.erase(s.begin(), s.find(4));  // 删除 1, 2, 3

```

## find()

`set.find()` 的返回值是一个  **迭代器** ，指向集合中与指定值匹配的元素。如果找到了指定的值，`find()` 会返回指向该值的迭代器；如果找不到，则返回 `set.end()` 迭代器。

```cpp
auto it = s.find(3);

    if (it != s.end()) {
        std::cout << "找到了元素：" << *it << std::endl;  // 输出：找到了元素：3
    } else {
        std::cout << "未找到元素" << std::endl;
    }
```

## size()

`set.size()` 的返回值是一个 `size_t` 类型的非负整数，表示集合中元素的个数。

```cpp
int main() {
    std::set<int> s = {1, 2, 3, 4, 5};
    std::cout << "集合的大小为：" << s.size() << std::endl;  // 输出：集合的大小为：5
    return 0;
}
```

## empty()

`set.empty()` 的返回值是一个布尔值，表示集合是否为空。

```cpp
int main() {
    std::set<int> s;

    if (s.empty()) {
        std::cout << "集合是空的" << std::endl;
    } else {
        std::cout << "集合不为空" << std::endl;
    }

    s.insert(1);
    if (!s.empty()) {
        std::cout << "集合现在不为空了" << std::endl;
    }

    return 0;
}
```

# set运算

注意，c++算法库中自带取并集，交集，差集功能。但是在头文件 `#include<algorithm>`中。
因此，取并集，交集，差集功能并非只有set可用，对于vector等照样可以使用。

## 取并集 [set_union](https://legacy.cplusplus.com/reference/algorithm/set_union/?kw=set_union)

```cpp
set_union(a.begin,a.end,b.begin,b.end,inserter(c,c.begin))//set只能用此种，一个一个插入，容量自增

set_union(a.begin,a.end,b.begin,b.end,c.begin) //当c为vector时可用，且要提前预留足够的空间
```

上述函数将集合a，b取并集并放到集合c中。但是上下两种写法略有不同。
第一种将并集插入到集合c中，会保留集合中原有的数据。
第二种会直接覆盖集合c中前面的数据。
无论怎么说，推荐只用第一种，哪怕一开始为空容器
[inserter()](https://legacy.cplusplus.com/reference/iterator/inserter/?kw=inserter)

## 取交集[set_intersection](https://legacy.cplusplus.com/reference/algorithm/set_intersection/?kw=set_intersection)

```cpp
set_intersection(a.begin,a.end,b.begin,b.end,inserter(c,c.begin))//set只能用此种
```

## 取集合对称差集[set_symmetric_difference](https://legacy.cplusplus.com/reference/algorithm/set_symmetric_difference/?kw=set_symmetric_difference)

```cpp
set_symmetric_difference(a.begin,a.end,b.begin,b.end,inserter(c,c.begin))//set只能用此种
```
