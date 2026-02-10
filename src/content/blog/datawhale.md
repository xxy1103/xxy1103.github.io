---
title:  "Datawhale AI夏令营 大模型微调 task3 笔记"

date: 2024-08-16 15:58:56

tags: "Datawhale"
---
# 数据增强

## 调用大模型

在本次任务中，我们通过星火Max模型对于训练材料进行增强，主要是对于每道阅读题补足4道单选题并给出答案，扩充训练数据。在注册好星火大模型后我们先安装调用大模型的sdk。

```python
# 环境安装
pip install --upgrade spark_ai_python
```

安装完成后，这里给出调用星火大模型的代码，实际使用时只需填入自己的参数调用函数即可。

```python
from sparkai.llm.llm import ChatSparkLLM, ChunkPrintHandler
from sparkai.core.messages import ChatMessage

#星火认知大模型Spark Max的URL值，其他版本大模型URL值请前往文档（https://www.xfyun.cn/doc/spark/Web.html）查看
SPARKAI_URL = 'wss://spark-api.xf-yun.com/v3.5/chat'
#星火认知大模型调用秘钥信息，请前往讯飞开放平台控制台（https://console.xfyun.cn/services/bm35）查看
SPARKAI_APP_ID = ''
SPARKAI_API_SECRET = ''
SPARKAI_API_KEY = ''
#星火认知大模型Spark Max的domain值，其他版本大模型domain值请前往文档（https://www.xfyun.cn/doc/spark/Web.html）查看
SPARKAI_DOMAIN = 'generalv3.5'

def call_sparkai(prompt):
    spark = ChatSparkLLM(
        spark_api_url=SPARKAI_URL,
        spark_app_id=SPARKAI_APP_ID,
        spark_api_key=SPARKAI_API_KEY,
        spark_api_secret=SPARKAI_API_SECRET,
        spark_llm_domain=SPARKAI_DOMAIN,
        streaming=False,
    )
    messages = [ChatMessage(
        role="user",
        content=prompt
    )]
    handler = ChunkPrintHandler()
    a = spark.generate([messages], callbacks=[handler])
    return a.generations[0][0].text
```

此外，大模型调用可能会出现超时报错的情况，若出现这一问题，可以通过重新尝试一次来解决，若针对一道题目多次报错，就返回‘error’来特殊处理。

优化如下：

```python
def call_sparkai(prompt):
    spark = ChatSparkLLM(
        spark_api_url=SPARKAI_URL,
        spark_app_id=SPARKAI_APP_ID,
        spark_api_key=SPARKAI_API_KEY,
        spark_api_secret=SPARKAI_API_SECRET,
        spark_llm_domain=SPARKAI_DOMAIN,
        streaming=False,
    )
    messages = [ChatMessage(
        role="user",
        content=prompt
    )]
    handler = ChunkPrintHandler()
    try:
        a = spark.generate([messages], callbacks=[handler])
    except Exception as e:
        print(e)
        return 'error'
    return a.generations[0][0].text


def call_sparkai_with_retry(prompt, retries=3, delay=5):
    for attempt in range(retries):
        try:
            resm = call_sparkai(prompt)
            return resm
        except TimeoutError:
            if attempt < retries - 1:
                print(f"请求超时，正在重试... ({attempt + 1}/{retries})")
                time.sleep(delay)
            else:
                print("请求超时，已达到最大重试次数。")
                return 'error'

```

## 处理数据

想让大模型产生出高质量的题目，我们就需要设计好提交给大模型的prompt，这里Datawhale设计好的prompt如下：

```
def get_adddata_prompt_zero(reading, cankao_content, question, answer):
    prompt = f'''你是一个高考英语阅读题出题专家，请阅读材料，需要参考参考内容 按照要求将题目、选项、答案对其补充完整。

###阅读材料
{reading}

###要求
1.需要将序号对应的题目与答案做匹配。
2.匹配后格式按照问题、ABCD四个选项顺序、答案的结构组合，按照参考内容格式输出。
3.如果选择题目数量不够四个请根据阅读材料及出题思路再生成题目，总题目达到四个。
4.题目中不能出现任何不合理的词汇、语法错误。
5.如果有简答题目与答案请忽略这部分内容，只处理选择题目。

###参考内容
{cankao_content}

###题目
{question}

###答案
{answer}
'''
    return prompt
```

要组成完整的prompt，我们需要传入阅读材料，参考内容，题目，答案四个部分，对于参考内容，我们也给出固定的内容：

```
cankao_content = '''
1. 以下哪个选项是“具身认知”的定义？
A. 认知在功能上的独立性、离身性构成了两种理论的基础。
B. 认知在很大程度上是依赖于身体的。
C. 认知的本质就是计算。
D. 认知和心智根本就不存在。

答案：B

2. 以下哪个实验支持了“具身认知”的假设？
A. 一个关于耳机舒适度的测试。
B. 一个关于眼睛疲劳程度的测试。
C. 一个关于人类感知能力的实验。
D. 一个关于人类记忆力的实验。

答案：A

3. 以下哪个选项是“离身认知”的教育观的特点？
A. 教育仅仅是心智能力的培养和训练，思维、记忆和学习等心智过程同身体无关。
B. 教育观认为身体仅仅是一个“容器”，是一个把心智带到课堂的“载体”。
C. 教育观认为知识经验的获得在很大程度上依赖于我们身体的体验性。
D. 教育观认为知识经验的获得在很大程度上依赖于我们大脑的记忆能力。

答案：A

4. 以下哪个选项是“具身认知”带来的教育理念和学习理念的变化？
A. 更强调全身心投入的主动体验式学习。
B. 更注重操作性的体验课堂，在教学过程中将学生的身体充分调动起来，这在教授抽象的概念知识时尤为重要。
C. 更强调教师的教学方法和学生的学习方法。
D. 更注重教师的教学技巧和学生的学习技巧。

答案：A'''

```

这样我们只需要设计好剩下的程序就好。

### 自主补全部分

首先我们先读取‘训练集-语文.xlsx’中的内容，并按照baseline1处理数据。

```
df = pd.read_excel('训练集-语文.xlsx')
df = df.replace('．', '.', regex=True)
df = df.replace('（', '(', regex=True)
cn_input,cn_output = process_cn(df)
```

    想要让大模型增强我们的数据，我们需要先将阅读文本，阅读题目，阅读答案，三部分拆解开来，再让大模型对于阅读的题目部分进行补全扩充，返回给我们，若大模型处理失败的题目，我们就依然按照baseline1中的处理方法，不再让大模型增强。

```python
success = 0 	#增强成功的个数
fail = 0	#增强失败的个数

def process_cn(df): 
    global success
    global fail
    # 定义好返回列表
    res_input = []
    res_output = []

    for id in range(len(df)):
        # 逐个遍历每行的选项、答案、阅读文本的内容
        data_options = df.loc[id, '选项']
        data_answers = df.loc[id,'答案']
        data_prompt = df.loc[id,'阅读文本']
	#合成让大模型增强数据的prompt
        prompt = get_adddata_prompt_zero(data_prompt, cankao_content, data_options, data_answers)
        resm = call_sparkai_with_retry(prompt)
	#合成最后训练的prompt
        data_prompt = get_prompt_cn(data_prompt)
	#如果增强失败，就常规处理
        if resm == 'error':
            fail += 1
            data_options = chinese_multiple_choice_questions(data_options)
        # 处理答案部分，抽取出选择题答案
            data_answers = chinese_multiple_choice_answers(data_answers)
        # 抽取阅读材料组合成input内容
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
      #增强成功，直接将大模型生成的答案用作outout
	else:
            success += 1
            res_output.append(resm)
            res_input.append(data_prompt)
    # 返回处理后的input、output数据
    return res_input, res_output
```

对于别的函数我并未进行修改，我直接给出Datawhale 夏令营中baseline的代码：

```python
def get_prompt_cn(text):
    prompt = f'''
    你是⼀个⾼考选择题出题专家，你出的题有⼀定深度，你将根据阅读文本，出4道单项选择题，包含题目选项，以及对应的答案，注意：不⽤给出原文，每道题由1个问题和4个选项组成，仅存在1个正确答案，请严格按照要求执行。 阅读文本主要是中文，你出的题目需要满足以下要点，紧扣文章内容且题干和答案为中文：
  
    ### 回答要求
    (1)理解文中重要概念的含义
    (2)理解文中重要句子的含意
    (3)分析论点、论据和论证方法
  
  
    ### 阅读文本
    {text}
    '''
  
    return prompt   

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
    questions = question_pattern.findall(text)

    # 初始化选择题和简答题列表
    multiple_choice_questions = []
    short_answer_questions = []

        # 处理每个问题
    for id,question in enumerate(questions):
        # 这里取到的question，如果是选择题会带着选择题的选项。
        # 检查是否是选择题 因为选择题内有ABCD这样的选项
        if re.search(r'[A-D]', question):
            # 如果有选项，提取出选项的内容
            choices = choice_pattern.findall(question)
            # 这里提取了题目的内容，因为每个题目都会有一个打分的（X分）这样的标记
            # 以左括号为目标，截取选择题选项中的内容
            question_text = re.split(r'\n', question.split('(')[0])[0]
    
    
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

这样我们就成功对于语文的数据进行了一定程度的增强。若是还想进一步增强，还可以通过对于一道阅读生成多组题目的方法，来扩充训练数据量，这里并未尝试。

### 英语部分

英语数据增强与语文大同小异，这里不再过多解释，直接给出代码：

```
from sparkai.llm.llm import ChatSparkLLM, ChunkPrintHandler
from sparkai.core.messages import ChatMessage
import pandas as pd
import re
import json
import time
#星火认知大模型Spark Max的URL值，其他版本大模型URL值请前往文档（https://www.xfyun.cn/doc/spark/Web.html）查看
SPARKAI_URL = 'wss://spark-api.xf-yun.com/v3.5/chat'
#星火认知大模型调用秘钥信息，请前往讯飞开放平台控制台（https://console.xfyun.cn/services/bm35）查看
SPARKAI_APP_ID = ''
SPARKAI_API_SECRET = ''
SPARKAI_API_KEY = ''
#星火认知大模型Spark Max的domain值，其他版本大模型domain值请前往文档（https://www.xfyun.cn/doc/spark/Web.html）查看
SPARKAI_DOMAIN = 'generalv3.5'

def call_sparkai(prompt):
    spark = ChatSparkLLM(
        spark_api_url=SPARKAI_URL,
        spark_app_id=SPARKAI_APP_ID,
        spark_api_key=SPARKAI_API_KEY,
        spark_api_secret=SPARKAI_API_SECRET,
        spark_llm_domain=SPARKAI_DOMAIN,
        streaming=False,
    )
    messages = [ChatMessage(
        role="user",
        content=prompt
    )]
    handler = ChunkPrintHandler()
    try:
        a = spark.generate([messages], callbacks=[handler])
    except Exception as e:
        print(e)
        return 'error'
    return a.generations[0][0].text

cankao_content = '''
1. Which of the following is not a type of art form that Nick Smith uses in his pixelated collages?
A. Painting
B. Photography
C. Embroidery
D. Video art

Answer：C


2. What does the word "Psychology" in the title PSYCOLOURGY: January 2015 refer to in relation to Nick Smith's work?
A. The study of human behavior and mental processes
B. The concept of using colour to convey emotions and ideas
C. The use of pixelated image in his collages
D. A specific series of artworks from 2015

Answer：B


3. Which of the following is true about Nick Smith's career as an artist?
A. He has only worked in the fine arts category
B. His work is primarily focused on interior design
C. He has never used hand-made collages in his work
D. His first collage experiment was inspired by Marilyn Monroe

Answer：D


4. Which of the following can be inferred about the text employed in Nick Smith's work?
A. It is always narrative and sequential
B. It is often open to interpretation by the viewer
C. It is always written in a specific language or script
D. It is always placed under each swatch of colour

Answer：B


'''


# 示例文本

def get_questions(text):
    # 数据清洗，将所有换行改为两个空格方便统一处理
    text = text.replace('\n', '  ')+'  '
    # print(text)
    # 正则表达式模式
    # 通过匹配以数字开头然后带一个点，为题干
    # 然后抽取选项A  以A开头 后面带一个点 最后以两个空格结尾
    # 为什么是两个空格？部分数据换行时为换行符，我们已经换成了两个空格，有些是以多个空格分割，我们默认为两个空格
    # 接着匹配B C D选项内容
    # 最后有一个
    pattern = re.compile(r'(\d+\..*?)(A\..*?\s{2})([B-D]\..*?\s{2})([B-D]\..*?\s{2})(D\..*?\s{2})', re.DOTALL)

    # 查找所有匹配项
    matches = pattern.findall(text)

    # 存储结果的字典列表
    questions_dict_list = []

    # 打印结果
    for match in matches:
        question, option1, option2, option3, option4 = match
        pattern_question = re.compile(r'(\d+)\.(.*)')
        # 第一个为选择题的题目 提前存到question_text 
        question_text = pattern_question.findall(question.strip())[0][1]
  
        # 提取选项字母和内容
        options = {option1[0]: option1, option2[0]: option2, option3[0]: option3, option4[0]: option4}
  
        question_dict = {
            'question': question_text,
            # 这一步就是防止ACBD这种乱序，我们进行重新匹配，将可能是ACBD的数据以首字母按位置排好号
            'options': {
                'A': options.get('A', '').strip(),
                'B': options.get('B', '').strip(),
                'C': options.get('C', '').strip(),
                'D': options.get('D', '').strip()
            }
        }
  
        questions_dict_list.append(question_dict)
    # 最后获得
    return questions_dict_list

# 首先做数据清洗，将空格、换行符及点都删除
def remove_whitespace_and_newlines(input_string):
    # 使用str.replace()方法删除空格和换行符
    result = input_string.replace(" ", "").replace("\n", "").replace(".", "")
    return result

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

def get_adddata_prompt_zero(reading, cankao_content, question, answer):
    prompt = f'''你是一个高考英语阅读题出题专家，请阅读材料，需要参考参考内容 按照要求将题目、选项、答案对其补充完整。

###阅读材料
{reading}

###要求
1.需要将序号对应的题目与答案做匹配。
2.匹配后格式按照问题、ABCD四个选项顺序、答案的结构组合，按照参考内容格式输出。
3.如果选择题目数量不够四个请根据阅读材料及出题思路再生成题目，总题目达到四个。
4.题目中不能出现任何不合理的词汇、语法错误。
5.如果有简答题目与答案请忽略这部分内容，只处理选择题目。
6.题目编号从1开始。

###参考内容
{cankao_content}

###题目
{question}

###答案
{answer}
'''
    return prompt

success = 0
fail = 0

def call_sparkai_with_retry(prompt, retries=3, delay=5):
    for attempt in range(retries):
        try:
            resm = call_sparkai(prompt)
            return resm
        except TimeoutError:
            if attempt < retries - 1:
                print(f"请求超时，正在重试... ({attempt + 1}/{retries})")
                time.sleep(delay)
            else:
                print("请求超时，已达到最大重试次数。")
                return 'error'

def process_en(df): 
    global success
    global fail
    res_input = []
    res_output = []
    for id in range(len(df)):
        data_options = df.loc[id, '选项']
        data_answers = df.loc[id,'答案']
        data_prompt = df.loc[id,'阅读文本']
        prompt = get_adddata_prompt_zero(data_prompt, cankao_content, data_options, data_answers)
        resm = call_sparkai_with_retry(prompt)
        data_prompt = get_prompt_en(data_prompt)
        if resm == 'error':
            fail += 1
            data_options = get_questions(data_options)
            data_answers = get_answers(data_answers)
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
        else:
            success += 1
            res_output.append(resm)
            res_input.append(data_prompt)
    return res_input,res_output
    # break

if __name__ == '__main__':
    df = pd.read_excel('训练集-英语.xlsx')
    df = df.replace('．', '.', regex=True).replace('А.', 'A.', regex=True).replace('В.', 'B.', regex=True).replace('С.', 'C.', regex=True).replace('D.', 'D.', regex=True)
    en_input,en_output = process_en(df)
    print("success:",success)
    print("fail:",fail)
    data = []
    for i in range(len(en_input)):
        data.append({'input':en_input[i],'output':en_output[i]})
    #保存json文件
    with open('output_en.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
```

# 大模型评分

大模型评分的优势：

* 细致且可操作的反馈：提供针对绩效各方面的详细反馈。
* 客观性和公正性：减少人类主观性和偏见，促进公平。
* 效率和可扩展性：AI系统能快速处理大量数据，提高评分效率。
* 一致性和标准化：LLMs通过训练和微调，确保评分的一致性。

大模型评分的prompt：

```
judgement = f'''
你是一个高考阅读题目出题专家，你需要根据下面要求结合阅读文章对题目及答案这样的出题情况进行打分，根据要求一步一步打分，得到有效分数后你将得到100万元的报酬，给出最终得分情况，以“总分:XX分”的形式返回。

### 阅读文章
{reading}

### 题目及答案
{QA}

### 要求

1. 判断给出的题目及答案，题目是否为四道，如果不满足四道，少一道题扣10分，如果每个题目没有答案，少一个答案扣5分。
1. 给出题目选项与答案匹配正确度给分，通过阅读文章每分析道题目正确，则给5分，如果错误给0分。四道题满分20分。
2. 给出题目与选项在阅读文章中的匹配程度给分，每道题目符合阅读文章且选择答案复合题目并可用通过阅读文章分析得到，完全符合给3分，完全不符合给0分。四道题满分12分。
3. 给出题目与选项是否符合高考难度，每道题目与答案是否符合高考的难度，完全符合给3分，完全不符合给0分。四道题满分12分。
4. 给出最终得分情况,对上面三个分数进行求和得到总分，以“总分:XX分”的形式返回，三个问题满分共44分。
'''

score = call_sparkai(judgement)
score
```

最后我们使用正则表达式简单处理就能得到数字分数：

```python
import re

text = score.replace(' ', '')

# 使用正则表达式匹配阅读文本后的内容

match = re.search(r'总分：(\d+)分', text)

if match:
    content = match.group(1)
    print(int(content))
else:
    print("未找到匹配的内容")
```
