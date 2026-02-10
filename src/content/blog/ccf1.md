---
title: CCF 202212-2 训练计划
date: 2024-07-26 12:22:56
tags: "CCF"
---

# CCF 202212-2 训练计划
解答如下：
使用day数组记录每个计划开始前需要训练的时间
使用day1数组记录每个计划开始到该计划以及后面所有计划结束的时间
```
#include<iostream>
#include <vector>
#include <algorithm>
using namespace std;
int n,m;
vector<vector<int>> arr(101,vector<int>(2,0));
vector<int> day(101,0),day1(101,0);
int cp_day(int x,int day_b) {
    day1[x] =(day_b+arr[x][1])>day1[x]?(day_b+arr[x][1]):day1[x];
    if(arr[x][0] == 0)
        return arr[x][1];
    else
        return arr[x][1]+ cp_day(arr[x][0],day1[x]);
}
int main() {
    cin >> n >>m;
    for(int i = 1;i<=m;i++)
        cin >> arr[i][0];
    for(int i = 1;i<=m;i++)
        cin >> arr[i][1];
    int judge = 1;
    for(int i = 1;i<=m;i++) {
        day1[i] = arr[i][1];
        if(arr[i][0] == 0)
            day[i] = arr[i][1];
        else
            day[i] = cp_day(arr[i][0],arr[i][1]) + arr[i][1];
        if (day[i] > n)
            judge = 0;
    }
    for(int i = 1;i<=m;i++) {
        if(arr[i][0] == 0)
            cout << 1 << " ";
        else
            cout << 1+day[arr[i][0]]<<' ';
    }
    if(judge == 1) {
        cout << endl;
        for(int i = 1;i<=m;i++)
            cout << n-day1[i] + 1 << " ";
    }
    return 0;
}
```