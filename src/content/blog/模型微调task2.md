---
title: 	"大模型微调 baseline1 学习"
date: 2024-08-14 10:46:56
tags: "Datawhale"
---

[原文链接](https://datawhaler.feishu.cn/wiki/Ew1HwldMBiz2O4kbrI3cYkPXnpf)


# 数据提取部分

## input数据提取
input部分由**阅读材料**以及**相关要求** 组成，我们拟通过正则表达式来匹配文字，通过[pandas](https://www.runoob.com/pandas/pandas-tutorial.html)来处理xlsx文件

我们将，提取的数据存取为json格式，其中每条数据拥有两个字段`input`与`output`。
input由 `prompt` + `阅读文本` 组成
output由 `选项`+ `答案` 组成
### 语文题目
1. 抽取数据，加载excel中的数据
```

import pandas as pd
import re

df = pd.read_excel('训练集-语文.xlsx')
df = df.replace('．', '.', regex=True)
df = df.replace('（', '(', regex=True)

```
2. 此为语文题目的处理函数，此处`questions_with_answers`为每个阅读的题目部分,包含选择题与非选择题。
```
def chinese_multiple_choice_questions(questions_with_answers):
    # 输入的题目文本
    text = questions_with_answers

    
    question_pattern = re.compile(r'\d+\..*?(?=\d+\.|$)', re.DOTALL)
    # 这一行作用是匹配一个以数字开头、后面跟着一个点字符的字符串，
    #。直到遇到下一个数字和点字符或字符串结束。
    choice_pattern = re.compile(r'([A-D])\s*(.*?)(?=[A-D]|$|\n)', re.DOTALL)
    # 这一行作用是匹配一个以字母[A到D]开头、后面跟着一个点字符的字符串，
    #直到遇到下一个[A到D]或字符串结束。
    
    
    # 找到所有问题
    questions = question_pattern.findall(text)#以题目的匹配模式匹配text中所有符合要求的字段

    # 初始化选择题和简答题列表
    multiple_choice_questions = []
    short_answer_questions = []

        # 处理每个问题
    for id,question in enumerate(questions): # id为当前问题的索引
        # 这里取到的question，如果是选择题会带着选择题的选项。
        # 检查是否是选择题 因为选择题内有ABCD这样的选项
        if re.search(r'[A-D]', question):
            # 如果有选项，提取出选项的内容
            choices = choice_pattern.findall(question)
            # 这里提取了题目的内容，因为每个题目都会有一个打分的（X分）这样的标记
            # 以左括号为目标，截取选择题选项中的内容
            question_text = re.split(r'\n', question.split('(')[0])[0] # split() 字符串分割函数
            
            
            pattern_question = re.compile(r'(\d+)\.(.*)')
            # 这里清洗了选择题的编号，重新用循环中的id进行编号。
            # 如果不做这一步可以发现给定的数据中编号是乱序的。
            matches_question = str(id+1)+'.'+ pattern_question.findall(question_text)[0][1] # 取出问题后重排序
            # print(str(id+1)+'.'+matches_question)
            
            # 这里我们实现声明好了存储的列表
            # 将每个问题和选项以字典的形式存入方便我们处理
            multiple_choice_questions.append({
                'question': matches_question,
                'choices': choices
            })
        else:
            # 大家可以想想这里怎么用？
            short_answer_questions.append(question.strip())
    # 最后我们返回抽取后的选择题字典列表
    return multiple_choice_questions
```
3. 抽取问题答案
依然使用正则表达式匹配每一题的答案，只需保存选择题答案，并且根据id重新编号。
```
def chinese_multiple_choice_answers(questions_with_answers):
    # 首先清洗输入字段，因为答案字段中的格式不统一，清洗后便于统一处理。
    # 这里删除了所有的换行和空格
    questions_with_answers = questions_with_answers.replace(" ", "").replace("\n", "")
    
    # print(questions_with_answers)
    # 使用正则表达式匹配答案
    # 这里我们主要使用第一个匹配 一个数字+点+字母ABCD之间一个
    choice_pattern = re.compile(r'(\d+)\.([A-Z]+)')
    # 下面这句匹配的是简答题答案~  目前可以忽略
    short_pattern = re.compile(r'(\d+)\.([^A-Z]+)')

    # 找到所有匹配的答案
    choice_matches = choice_pattern.findall(questions_with_answers)
    short_matches = short_pattern.findall(questions_with_answers)

    # 将匹配结果转换为字典
    choice_answers = {int(index): answer for index, answer in choice_matches}
    short_answers = {int(index): answer for index, answer in short_matches}

    # 按序号重新排序
    sorted_choice_answers = sorted(choice_answers.items())
    sorted_short_answers = sorted(short_answers.items())
    
    answers = []

    # 输出结果
    
    # print("选择题答案：")
    for id in range(len(sorted_choice_answers)):
    # 这里我们也将重新编号号的答案作为返回，返回的是一个列表，方便与问题字典列表匹配~
        answers.append(f"{id+1}. {sorted_choice_answers[id][1]}")
    return answers

```

4. prompt生成
prompt由**阅读文本**+**要求**组成
```
def get_prompt_cn(text):
    prompt = f'''
    你是⼀个⾼考选择题出题专家，你出的题有⼀定深度，你将根据阅读文本，出4道单项选择题，包含题目选项，以及对应的答案，注意：不⽤给出原文，每道题由1个问题和4个选项组成，仅存在1个正确答案，请严格按照要求执行。 阅读文本主要是中文，你出的题目需要满足以下要点，紧扣文章内容且题干和答案为中文：
    
    ###回答要求
    (1)理解文中重要概念的含义
    (2)理解文中重要句子的含意
    (3)分析论点、论据和论证方法
    
    
    ###阅读文本
    {text}
    '''
    
    return prompt   
```
5. 处理所有数据
设计好了所有函数，接下来就是在主函数中将数据拆分组合为input与output部分。
```
def process_cn(df): 
    #定义好返回列表
    res_input = []
    res_output = []

    for id in range(len(df)):
        # 逐个遍历每行的选项、答案、阅读文本的内容
        data_options = df.loc[id, '选项']
        data_answers = df.loc[id,'答案']
        data_prompt = df.loc[id,'阅读文本']
        # 处理选项部分，抽取出选择题题目及选项
        data_options = chinese_multiple_choice_questions(data_options)
        # 处理答案部分，抽取出选择题答案
        data_answers = chinese_multiple_choice_answers(data_answers)
        # 抽取阅读材料组合成input内容
        data_prompt = get_prompt_cn(data_prompt)
        # print(data_options)
        # print(data_answers)
        # 做数据验证，因为训练数据格式不能确定每组数据都能被正常处理（会有一部分处理失败）
        # 我们验证一下两个列表的长度 如果相同代表数据处理正确
        if(len(data_answers)==len(data_options)):
            # 定义output的数据字符串
            res = ''
            # 处理选择题目中的每个数据，逐个拼入到output字符串
            for id_,question in enumerate(data_options):
            # 首先放入题目
                res += f'''
{question['question']}?
                '''+'\n'
                # 然后找到选择题的每个选项，进行choices列表循环
                for choise in question['choices']:
                # 逐个将选项拼接到字符串
                    res = res+ choise[0] + choise[1]+ '\n'
                #  最后将答案拼接到每个选择题的最后
                # 以 答案：题号.选项的格式
                res = res + '答案:' + str(data_answers[id_].split('.')[-1])  + '\n'
            # 最后将处理得到的input、output数据存入到列表
            res_output.append(res)
            res_input.append(data_prompt)
        # break
    return res_input,res_output
``` 

### 英语部分

英语部分与语文部分大同小异，这里我们只给出代码
```
#首先做数据清洗，将空格、换行符及点都删除
def remove_whitespace_and_newlines(input_string):
    # 使用str.replace()方法删除空格和换行符
    result = input_string.replace(" ", "").replace("\n", "").replace(".", "")
    return result

import re

    #示例文本
text = """
32. B. The underlying logic of the effect.                                                   33.D. estimates were not fully independent.
34.C. The discussion process.            35.D. Approving.
"""
def get_answers(text):
    text = remove_whitespace_and_newlines(text)
    # 正则表达式模式
    # 这里是一个数字加一个A-D的大写字母表示为答案区域，因为有些答案中有解释，这样的匹配规则可以尽可能匹配到答案
    pattern = re.compile(r'(\d)\s*([A-D])')

    # 查找所有匹配项
    matches = pattern.findall(text)
    res = []
    # 打印结果
    for match in matches:
        number_dot, first_letter = match
        res.append(first_letter)
    return res

def get_prompt_en(text):
    prompt = f'''
    你是⼀个⾼考选择题出题专家，你出的题有⼀定深度，你将根据阅读文本，出4道单项选择题，包含题目选项，以及对应的答案，注意：不⽤给出原文，每道题由1个问题和4个选项组成，仅存在1个正确答案，请严格按照要求执行。
The reading text is mainly in English. The questions and answers you raised need to be completed in English for at least the following points:
    
    ### 回答要求
    (1)Understanding the main idea of the main idea.
    (2)Understand the specific information in the text.
    (3)infering the meaning of words and phrases from the context
    
    
    ### 阅读文本
    {text}
    '''
    
    return prompt 

def process_en(df): 
    res_input = []
    res_output = []
    for id in range(len(df)):
        data_options = df.loc[id, '选项']
        data_answers = df.loc[id,'答案']
        data_prompt = df.loc[id,'阅读文本']
        data_options = get_questions(data_options)
        data_answers = get_answers(data_answers)
        data_prompt = get_prompt_en(data_prompt)
        # print(data_options)
        # print(data_answers)

        if(len(data_answers)==len(data_options)):
            res = ''
            for id,question in enumerate(data_options):
                res += f'''
                {id+1}.{question['question']}
                {question['options']['A']}
                {question['options']['B']}
                {question['options']['C']}
                {question['options']['D']}
                answer:{data_answers[id]}
                '''+'\n'
            res_output.append(res)
            res_input.append(data_prompt)
    return res_input,res_output
    # break

``` 

# 数据合并
将中文与英文的数据合并，总共只有102条，为凑够150条，我们将中文前30条与英文前20条重复录入。

```
df_new = pd.DataFrame({'input': cn_input+cn_input[:30]+en_input+en_input[:20], 'output': cn_output+cn_output[:30]+en_output+en_output[:20]})
``` 
其中pd.DataFrame({...})：使用 pandas 库创建一个数据框。