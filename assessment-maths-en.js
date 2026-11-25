/* English text for the four original S1 equation and S2 percentage papers. */
(function (root) {
  'use strict';

  const papers = {
    "s1-equations-a": {
      "sourceTitle": "一元一次方程與應用 A 卷",
      "title": "Linear Equations in One Unknown and Their Applications – Paper A",
      "description": "12 questions · 24 marks. Show your main steps or give reasons for your answers.",
      "questions": {
        "q1": {
          "sourcePrompt": "一個數減去 13 後等於 −21。原數是多少？",
          "sourceKey": "[\"設原數為 x，x−13=−21；-8。\",[\"method\",\"設原數為 x，x−13=−21\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Inverse operations",
          "prompt": "A number minus 13 is −21. What is the original number?",
          "solution": "Let x be the original number. From x − 13 = −21, add 13 to both sides to get x = −8.",
          "criteria": {
            "method": "Represents the original number by x and forms x − 13 = −21.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q2": {
          "sourcePrompt": "解 7u−4u＋9=−6。",
          "sourceKey": "[\"合併得 3u=−15；-5。\",[\"method\",\"合併得 3u=−15\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Collecting like terms",
          "prompt": "Solve 7u − 4u + 9 = −6.",
          "solution": "Collect like terms to get 3u + 9 = −6. Then 3u = −15 and u = −5.",
          "criteria": {
            "method": "Collects like terms and rearranges to obtain 3u = −15.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q3": {
          "sourcePrompt": "解 9t＋4=5t＋30。",
          "sourceKey": "[\"兩邊減去 5t 和 4 得 4t=26；6.5。\",[\"method\",\"兩邊減去 5t 和 4 得 4t=26\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Variables on both sides",
          "prompt": "Solve 9t + 4 = 5t + 30.",
          "solution": "Subtract 5t and then 4 from both sides. This gives 4t = 26, so t = 6.5.",
          "criteria": {
            "method": "Subtracts 5t and 4 from both sides to obtain 4t = 26.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q4": {
          "sourcePrompt": "解 3(2p−5)＋4=31。",
          "sourceKey": "[\"展開得 6p−11=31；7。\",[\"method\",\"展開得 6p−11=31\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Expanding brackets",
          "prompt": "Solve 3(2p − 5) + 4 = 31.",
          "solution": "Expanding gives 6p − 15 + 4 = 31, or 6p − 11 = 31. Hence 6p = 42 and p = 7.",
          "criteria": {
            "method": "Expands and simplifies the left-hand side to obtain 6p − 11 = 31.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q5": {
          "sourcePrompt": "解 (x＋2)/3＋(x−1)/2=6。",
          "sourceKey": "[\"乘 6 得 2x＋4＋3x−3=36；7。\",[\"method\",\"乘 6 得 2x＋4＋3x−3=36\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Clearing fractions",
          "prompt": "Solve (x + 2)/3 + (x − 1)/2 = 6.",
          "solution": "Multiply both sides by 6 to get 2x + 4 + 3x − 3 = 36. Thus 5x + 1 = 36 and x = 7.",
          "criteria": {
            "method": "Multiplies both sides by 6 to obtain 2x + 4 + 3x − 3 = 36.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q6": {
          "sourcePrompt": "解 0.6h＋1.8=0.2h＋5。",
          "sourceKey": "[\"同乘 10 並移項得 4h=32；8。\",[\"method\",\"同乘 10 並移項得 4h=32\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Decimal coefficients",
          "prompt": "Solve 0.6h + 1.8 = 0.2h + 5.",
          "solution": "Multiplying by 10 gives 6h + 18 = 2h + 50. Rearranging gives 4h = 32, so h = 8.",
          "criteria": {
            "method": "Multiplies by 10 and rearranges to obtain 4h = 32.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q7": {
          "sourcePrompt": "兩段繩共長 92 cm，長段比短段的兩倍少 7 cm。短段長多少 cm？",
          "sourceKey": "[\"設短段長 x，x＋2x−7=92；33。\",[\"method\",\"設短段長 x，x＋2x−7=92\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Parts and totals",
          "prompt": "Two pieces of rope have a total length of 92 cm. The longer piece is 7 cm shorter than twice the length of the shorter piece. How long is the shorter piece, in cm?",
          "solution": "Let x cm be the length of the shorter piece. Then x + (2x − 7) = 92. Solving gives 3x = 99, so the shorter piece is 33 cm long.",
          "criteria": {
            "method": "Defines x as the length of the shorter piece and forms x + (2x − 7) = 92.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q8": {
          "sourcePrompt": "印刷費包括一次排版費 75 元及每冊 4.5 元。總費 282 元，印了多少冊？",
          "sourceKey": "[\"設冊數 n，75＋4.5n=282；46。\",[\"method\",\"設冊數 n，75＋4.5n=282\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Fixed and variable charges",
          "prompt": "A printer charges a one-off typesetting fee of $75 and $4.50 for each booklet. The total bill is $282. How many booklets were printed?",
          "solution": "Let n be the number of booklets. From 75 + 4.5n = 282, we get 4.5n = 207 and n = 46. The printer produced 46 booklets.",
          "criteria": {
            "method": "Defines n as the number of booklets and forms 75 + 4.5n = 282.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q9": {
          "sourcePrompt": "藍珠與白珠數量比為 2：3。加入 12 粒藍珠後兩色數量相等。原有多少粒白珠？",
          "sourceKey": "[\"設原數為 2k、3k，2k＋12=3k，故 k=12；36。\",[\"method\",\"設原數為 2k、3k，2k＋12=3k，故 k=12\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Changes in a ratio",
          "prompt": "The numbers of blue and white beads are in the ratio 2 : 3. After 12 blue beads are added, there are equal numbers of the two colours. How many white beads were there originally?",
          "solution": "Let the original numbers of blue and white beads be 2k and 3k. Then 2k + 12 = 3k, so k = 12. There were 3 × 12 = 36 white beads.",
          "criteria": {
            "method": "Represents the original counts by 2k and 3k and uses 2k + 12 = 3k to obtain k = 12.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q10": {
          "sourcePrompt": "小慧比小明先走 240 m。兩人同向，每分鐘分別走 60 m 及 80 m。小明起步後多少分鐘追上？",
          "sourceKey": "[\"設時間 t，有 80t=240＋60t；12。\",[\"method\",\"設時間 t，有 80t=240＋60t\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Catch-up problems",
          "prompt": "Wai has a 240 m head start on Ming. They walk in the same direction. Wai walks at 60 m per minute and Ming at 80 m per minute. How many minutes after Ming starts walking will he catch up with Wai?",
          "solution": "Let t be the number of minutes after Ming starts. At the meeting point, 80t = 240 + 60t. Hence 20t = 240 and t = 12 minutes.",
          "criteria": {
            "method": "Defines the time t and equates the distances using 80t = 240 + 60t.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q11": {
          "sourcePrompt": "有人把 4−2(x＋3) 展開為 4−2x＋6。指出符號錯誤，寫出正確簡式。",
          "sourceKey": "[\"−2 須乘括號內兩項，常數項應為 −6；正確簡式是 −2x−2。\",[\"method\",\"−2 須乘括號內兩項，常數項應為 −6\",1,\"manual\"],[\"answer\",\"正確簡式是 −2x−2\",1,\"manual\"]]",
          "topic": "Checking algebraic working",
          "prompt": "A student expands 4 − 2(x + 3) to give 4 − 2x + 6. Identify the sign error and write the correct simplified expression.",
          "solution": "The factor −2 multiplies both terms in the brackets. It gives −6 when multiplied by 3. Thus 4 − 2(x + 3) = 4 − 2x − 6 = −2x − 2.",
          "criteria": {
            "method": "Explains that −2 multiplies both terms, giving −6 as the constant from the expansion.",
            "answer": "Gives the simplified expression −2x − 2."
          }
        },
        "q12": {
          "sourcePrompt": "方程 3(2x＋1)=6x＋k 對每一個 x 都成立。求 k。",
          "sourceKey": "[\"左邊展開為 6x＋3，比較常數項；3。\",[\"method\",\"左邊展開為 6x＋3，比較常數項\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Identities",
          "prompt": "The equation 3(2x + 1) = 6x + k holds for every value of x. Find k.",
          "solution": "Expanding the left-hand side gives 6x + 3. The constant terms must match, so k = 3.",
          "criteria": {
            "method": "Expands the left-hand side to 6x + 3 and compares the constant terms.",
            "answer": "Gives the correct numerical answer."
          }
        }
      }
    },
    "s1-equations-b": {
      "sourceTitle": "一元一次方程與應用 B 卷",
      "title": "Linear Equations in One Unknown and Their Applications – Paper B",
      "description": "12 questions · 24 marks. Show your main steps or give reasons for your answers.",
      "questions": {
        "q1": {
          "sourcePrompt": "一個數加上 17 後等於 −9。原數是多少？",
          "sourceKey": "[\"設原數為 x，x＋17=−9；-26。\",[\"method\",\"設原數為 x，x＋17=−9\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Inverse operations",
          "prompt": "A number plus 17 is −9. What is the original number?",
          "solution": "Let x be the original number. From x + 17 = −9, subtract 17 from both sides to get x = −26.",
          "criteria": {
            "method": "Represents the original number by x and forms x + 17 = −9.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q2": {
          "sourcePrompt": "解 12−2v＋7v=−8。",
          "sourceKey": "[\"合併得 12＋5v=−8；-4。\",[\"method\",\"合併得 12＋5v=−8\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Collecting like terms",
          "prompt": "Solve 12 − 2v + 7v = −8.",
          "solution": "Collect like terms to get 12 + 5v = −8. Thus 5v = −20 and v = −4.",
          "criteria": {
            "method": "Combines the terms in v to obtain 12 + 5v = −8.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q3": {
          "sourcePrompt": "解 3−4a=17−8a。",
          "sourceKey": "[\"兩邊加上 8a 並減 3 得 4a=14；3.5。\",[\"method\",\"兩邊加上 8a 並減 3 得 4a=14\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Variables on both sides",
          "prompt": "Solve 3 − 4a = 17 − 8a.",
          "solution": "Add 8a to both sides and subtract 3. This gives 4a = 14, so a = 3.5.",
          "criteria": {
            "method": "Adds 8a to both sides and subtracts 3 to obtain 4a = 14.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q4": {
          "sourcePrompt": "解 50−4(2b＋1)=6。",
          "sourceKey": "[\"展開得 46−8b=6；5。\",[\"method\",\"展開得 46−8b=6\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Expanding brackets",
          "prompt": "Solve 50 − 4(2b + 1) = 6.",
          "solution": "Expanding gives 50 − 8b − 4 = 6, or 46 − 8b = 6. Hence −8b = −40 and b = 5.",
          "criteria": {
            "method": "Expands and simplifies the left-hand side to obtain 46 − 8b = 6.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q5": {
          "sourcePrompt": "解 (y＋5)/4−(y−1)/6=2。",
          "sourceKey": "[\"乘 12 得 3y＋15−2y＋2=24；7。\",[\"method\",\"乘 12 得 3y＋15−2y＋2=24\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Clearing fractions",
          "prompt": "Solve (y + 5)/4 − (y − 1)/6 = 2.",
          "solution": "Multiply both sides by 12 to get 3y + 15 − 2y + 2 = 24. Thus y + 17 = 24 and y = 7.",
          "criteria": {
            "method": "Multiplies both sides by 12 to obtain 3y + 15 − 2y + 2 = 24.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q6": {
          "sourcePrompt": "解 1.2−0.3m=0.5m−6。",
          "sourceKey": "[\"同乘 10 並移項得 8m=72；9。\",[\"method\",\"同乘 10 並移項得 8m=72\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Decimal coefficients",
          "prompt": "Solve 1.2 − 0.3m = 0.5m − 6.",
          "solution": "Multiplying by 10 gives 12 − 3m = 5m − 60. Rearranging gives 8m = 72, so m = 9.",
          "criteria": {
            "method": "Multiplies by 10 and rearranges to obtain 8m = 72.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q7": {
          "sourcePrompt": "三層書架共有 103 本書。中層比上層多 5 本，下層比上層少 4 本。上層有多少本？",
          "sourceKey": "[\"設上層 x 本，x＋(x＋5)＋(x−4)=103；34。\",[\"method\",\"設上層 x 本，x＋(x＋5)＋(x−4)=103\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Parts and totals",
          "prompt": "There are 103 books on three shelves altogether. The middle shelf has 5 more books than the top shelf, and the bottom shelf has 4 fewer than the top shelf. How many books are on the top shelf?",
          "solution": "Let x be the number of books on the top shelf. Then x + (x + 5) + (x − 4) = 103. This gives 3x + 1 = 103, so there are 34 books on the top shelf.",
          "criteria": {
            "method": "Defines x as the number on the top shelf and forms x + (x + 5) + (x − 4) = 103.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q8": {
          "sourcePrompt": "租單車已繳 120 元，其中 30 元是按金，餘額支付每小時 15 元的租金。可租多少小時？",
          "sourceKey": "[\"設租用 h 小時，30＋15h=120；6。\",[\"method\",\"設租用 h 小時，30＋15h=120\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Fixed and variable charges",
          "prompt": "A cyclist has paid $120 to hire a bicycle. Of this, $30 is a deposit. The remainder covers the hire charge of $15 per hour. How many hours of hire does this cover?",
          "solution": "Let h be the number of hours. From 30 + 15h = 120, we get 15h = 90, so the payment covers 6 hours.",
          "criteria": {
            "method": "Defines h as the hire time in hours and forms 30 + 15h = 120.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q9": {
          "sourcePrompt": "甲乙兩組人數比為 4：3。甲組有 8 人轉往乙組後兩組相等，原來甲組有多少人？",
          "sourceKey": "[\"4k−8=3k＋8，所以 k=16；64。\",[\"method\",\"4k−8=3k＋8，所以 k=16\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Changes in a ratio",
          "prompt": "The numbers of people in groups A and B are in the ratio 4 : 3. After 8 people move from group A to group B, the groups have equal numbers of people. How many people were in group A originally?",
          "solution": "Let the original numbers be 4k and 3k. After the move, 4k − 8 = 3k + 8, so k = 16. Group A originally had 4 × 16 = 64 people.",
          "criteria": {
            "method": "Uses 4k − 8 = 3k + 8 for the transfer and obtains k = 16.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q10": {
          "sourcePrompt": "後車起步時前車領先 1.8 km。兩車同向，每分鐘分別前進 0.75 km（後車）及 0.60 km（前車）。多少分鐘後追上？",
          "sourceKey": "[\"設時間 t，0.75t=1.8＋0.60t；12。\",[\"method\",\"設時間 t，0.75t=1.8＋0.60t\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Catch-up problems",
          "prompt": "When the car behind sets off, the car in front has a lead of 1.8 km. The cars travel in the same direction, the rear car at 0.75 km per minute and the front car at 0.60 km per minute. After how many minutes will the rear car catch up?",
          "solution": "Let t be the time in minutes after the rear car sets off. Then 0.75t = 1.8 + 0.60t. Hence 0.15t = 1.8 and t = 12 minutes.",
          "criteria": {
            "method": "Defines the time t and equates the distances using 0.75t = 1.8 + 0.60t.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q11": {
          "sourcePrompt": "有人由 5−(3y−4)=0 得出 5−3y−4=0。指出錯處並寫出正確簡式（左邊）。",
          "sourceKey": "[\"括號前的負號令括號內兩項同時變號；正確簡式為 9−3y。\",[\"method\",\"括號前的負號令括號內兩項同時變號\",1,\"manual\"],[\"answer\",\"正確簡式為 9−3y\",1,\"manual\"]]",
          "topic": "Checking algebraic working",
          "prompt": "A student rewrites 5 − (3y − 4) = 0 as 5 − 3y − 4 = 0. Identify the error and simplify the left-hand side correctly.",
          "solution": "Subtracting the bracket changes the signs of both terms. The left-hand side is 5 − 3y + 4 = 9 − 3y.",
          "criteria": {
            "method": "Explains how the minus sign before the bracket changes the signs of both terms inside.",
            "answer": "Gives 9 − 3y as the simplified left-hand side."
          }
        },
        "q12": {
          "sourcePrompt": "方程 k(x−2)=5x−10 對任何 x 都成立。求 k。",
          "sourceKey": "[\"比較 x 的係數，並檢查常數 −2k=−10；5。\",[\"method\",\"比較 x 的係數，並檢查常數 −2k=−10\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Identities",
          "prompt": "The equation k(x − 2) = 5x − 10 holds for every value of x. Find k.",
          "solution": "The left-hand side expands to kx − 2k. Comparing the coefficients of x gives k = 5. This also gives −2k = −10, as required.",
          "criteria": {
            "method": "Compares the coefficients of x and checks that the constant terms satisfy −2k = −10.",
            "answer": "Gives the correct numerical answer."
          }
        }
      }
    },
    "s2-percent-a": {
      "sourceTitle": "百分法與商業應用 A 卷",
      "title": "Percentages and Business Applications – Paper A",
      "description": "12 questions · 24 marks. Show your main steps or give reasons for your answers.",
      "questions": {
        "q1": {
          "sourcePrompt": "書展售出 240 本書，其中 78 本是小說。小說佔多少百分比？填百分數數值。",
          "sourceKey": "[\"78÷240×100；32.5。\",[\"method\",\"78÷240×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Finding the percentage",
          "prompt": "Of the 240 books sold at a book fair, 78 were novels. What percentage of the books sold were novels? Enter the numerical value of the percentage.",
          "solution": "Take the total number of books sold as the base. The percentage is (78 ÷ 240) × 100% = 32.5%.",
          "criteria": {
            "method": "Uses (78 ÷ 240) × 100 to find the percentage.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q2": {
          "sourcePrompt": "球鞋減價 15% 後售 578 元。原價多少元？",
          "sourceKey": "[\"設原價 P，0.85P=578；680。\",[\"method\",\"設原價 P，0.85P=578\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Reverse percentages",
          "prompt": "A pair of trainers costs $578 after a 15% discount. What was the original price, in dollars?",
          "solution": "Let the original price be $P. The reduced price is 85% of P, so 0.85P = 578 and P = 680. The original price was $680.",
          "criteria": {
            "method": "Defines P as the original price and forms 0.85P = 578.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q3": {
          "sourcePrompt": "數量先增加 20% 再減少 15%。相對原來淨增加多少百分比？",
          "sourceKey": "[\"乘數 1.20×0.85=1.02；2。\",[\"method\",\"乘數 1.20×0.85=1.02\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Successive percentage changes",
          "prompt": "A quantity increases by 20% and then decreases by 15%. What is the net percentage increase relative to the original quantity?",
          "solution": "The combined multiplier is 1.20 × 0.85 = 1.02. The final quantity is 102% of the original, a net increase of 2%.",
          "criteria": {
            "method": "Multiplies the two factors to obtain 1.20 × 0.85 = 1.02.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q4": {
          "sourcePrompt": "貨品標價 480 元，先用 40 元現金券，再按餘額九折付款。實付多少元？",
          "sourceKey": "[\"(480−40)×0.9；396。\",[\"method\",\"(480−40)×0.9\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Order of discounts",
          "prompt": "An item has a marked price of $480. A $40 cash voucher is deducted first, then a 10% discount is applied to the balance. How much is paid, in dollars?",
          "solution": "After the voucher, the balance is $440. The amount paid is (480 − 40) × 0.9 = $396.",
          "criteria": {
            "method": "Deducts the voucher before applying the discount, using (480 − 40) × 0.9.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q5": {
          "sourcePrompt": "相機配件售價 345 元，成本 300 元。盈利佔成本百分之幾？",
          "sourceKey": "[\"(345−300)÷300×100；15。\",[\"method\",\"(345−300)÷300×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Profit and loss",
          "prompt": "A camera accessory sells for $345 and costs $300. What is the profit as a percentage of the cost?",
          "solution": "The profit is $345 − $300 = $45. As a percentage of the cost, this is (45 ÷ 300) × 100% = 15%.",
          "criteria": {
            "method": "Uses (345 − 300) ÷ 300 × 100 with the cost as the base.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q6": {
          "sourcePrompt": "店主希望八折出售後仍較成本 240 元多賺 20%。標價應為多少元？",
          "sourceKey": "[\"目標售價 240×1.2=288，再除以 0.8；360。\",[\"method\",\"目標售價 240×1.2=288，再除以 0.8\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Finding the marked price",
          "prompt": "An item costs a shopkeeper $240. The shopkeeper wants to make a profit of 20% of the cost after offering a 20% discount on the marked price. What should the marked price be, in dollars?",
          "solution": "The target selling price is 240 × 1.2 = $288. This is 80% of the marked price, so the marked price should be 288 ÷ 0.8 = $360.",
          "criteria": {
            "method": "Finds the target selling price as 240 × 1.2 = 288 and divides by 0.8.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q7": {
          "sourcePrompt": "到課率由 72% 升至 81%。寫出增加的百分點及相對增幅。",
          "sourceKey": "[\"以原到課率為基數，9÷72×100%=12.5%；增加 9 個百分點，相對增幅 12.5%。\",[\"method\",\"以原到課率為基數，9÷72×100%=12.5%\",1,\"manual\"],[\"answer\",\"增加 9 個百分點，相對增幅 12.5%\",1,\"manual\"]]",
          "topic": "Percentage points",
          "prompt": "The attendance rate rises from 72% to 81%. Give the increase in percentage points and the relative percentage increase.",
          "solution": "The rate rises by 81 − 72 = 9 percentage points. Relative to the original rate of 72%, the increase is (9 ÷ 72) × 100% = 12.5%.",
          "criteria": {
            "method": "Uses the original rate as the base in (9 ÷ 72) × 100% = 12.5%.",
            "answer": "Gives a rise of 9 percentage points and a relative increase of 12.5%."
          }
        },
        "q8": {
          "sourcePrompt": "甲店退貨率 4%，售出 150 件；乙店退貨率 10%，售出 50 件。整體退貨率是多少百分比？",
          "sourceKey": "[\"(6＋5)÷200×100；5.5。\",[\"method\",\"(6＋5)÷200×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Combining percentages",
          "prompt": "Shop A sells 150 items and has a return rate of 4%. Shop B sells 50 items and has a return rate of 10%. What percentage of all the items sold were returned?",
          "solution": "Shop A has 150 × 4% = 6 returns. Shop B has 50 × 10% = 5. The overall return rate is (6 + 5) ÷ 200 × 100% = 5.5%.",
          "criteria": {
            "method": "Adds the returns and divides by the total number of items sold, using (6 + 5) ÷ 200 × 100.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q9": {
          "sourcePrompt": "本金 6000 元按年單利 3% 存 8 個月。利息多少元？",
          "sourceKey": "[\"6000×0.03×8/12；120。\",[\"method\",\"6000×0.03×8/12\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Simple interest",
          "prompt": "A deposit of $6,000 earns simple interest at 3% per annum for 8 months. How much interest does it earn, in dollars?",
          "solution": "The deposit earns interest for 8/12 of a year. The simple interest is 6,000 × 0.03 × (8/12) = $120.",
          "criteria": {
            "method": "Calculates simple interest using 6,000 × 0.03 × (8/12).",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q10": {
          "sourcePrompt": "甲店定價 750 元打八八折；乙店同價減 95 元。較便宜的方案可省多少元？",
          "sourceKey": "[\"甲付 660，乙付 655，取差額；5。\",[\"method\",\"甲付 660，乙付 655，取差額\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Comparing offers",
          "prompt": "Shop A offers 12% off the marked price of $750. Shop B reduces the same marked price by $95. How much can you save, in dollars, by choosing the cheaper offer?",
          "solution": "At shop A the price is 750 × 0.88 = $660. At shop B it is 750 − 95 = $655. Choosing shop B saves $5.",
          "criteria": {
            "method": "Finds the two prices, $660 and $655, and takes their difference.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q11": {
          "sourcePrompt": "有同學說售價從 80 元升至 100 元，再降至 80 元，升幅和跌幅一樣。判斷並解釋。",
          "sourceKey": "[\"兩次變化的基數分別為 80 和 100；升幅 25%，跌幅 20%，兩者不同。\",[\"method\",\"兩次變化的基數分別為 80 和 100\",1,\"manual\"],[\"answer\",\"升幅 25%，跌幅 20%，兩者不同\",1,\"manual\"]]",
          "topic": "Checking percentage reasoning",
          "prompt": "A price rises from $80 to $100 and then falls to $80. A student says the percentage increase equals the percentage decrease. Do you agree? Explain.",
          "solution": "The $20 rise is measured against $80, giving 20 ÷ 80 × 100% = 25%. The $20 fall is measured against $100, giving 20 ÷ 100 × 100% = 20%. The percentages differ.",
          "criteria": {
            "method": "Identifies $80 and $100 as the respective bases for the two changes.",
            "answer": "Gives a 25% increase and a 20% decrease, and concludes they differ."
          }
        },
        "q12": {
          "sourcePrompt": "每袋餅成本 12 元，售價 20 元；當中 25% 售價用作平台費。要抵銷固定攤租 180 元，須售出多少袋？",
          "sourceKey": "[\"每袋淨貢獻=20×0.75−12=3，180÷3；60。\",[\"method\",\"每袋淨貢獻=20×0.75−12=3，180÷3\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Break-even sales",
          "prompt": "Each bag of biscuits costs $12 and sells for $20. The sales platform charges a fee of 25% of the selling price. How many bags must be sold to cover the fixed stall rent of $180?",
          "solution": "Each bag contributes 20 × 0.75 − 12 = $3 towards the rent. The number of bags needed is 180 ÷ 3 = 60.",
          "criteria": {
            "method": "Finds the contribution per bag as 20 × 0.75 − 12 = 3 and divides 180 by 3.",
            "answer": "Gives the correct numerical answer."
          }
        }
      }
    },
    "s2-percent-b": {
      "sourceTitle": "百分法與商業應用 B 卷",
      "title": "Percentages and Business Applications – Paper B",
      "description": "12 questions · 24 marks. Show your main steps or give reasons for your answers.",
      "questions": {
        "q1": {
          "sourcePrompt": "合唱團共有 64 人，其中 24 人是新團員。新團員佔多少百分比？",
          "sourceKey": "[\"24÷64×100；37.5。\",[\"method\",\"24÷64×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Finding the percentage",
          "prompt": "A choir has 64 members, of whom 24 are new. What percentage of the choir members are new?",
          "solution": "The percentage of new members is (24 ÷ 64) × 100% = 37.5%.",
          "criteria": {
            "method": "Uses 24 ÷ 64 × 100 to find the percentage.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q2": {
          "sourcePrompt": "電費加價 8% 後為 486 元，用量不變。加價前是多少元？",
          "sourceKey": "[\"設原費用 P，1.08P=486；450。\",[\"method\",\"設原費用 P，1.08P=486\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Reverse percentages",
          "prompt": "An electricity bill is $486 after an 8% increase in the tariff. Electricity usage is unchanged. How much would the bill have been before the increase, in dollars?",
          "solution": "Let the original bill be $P. At the same usage, 1.08P = 486, so P = 450. The original bill would have been $450.",
          "criteria": {
            "method": "Defines P as the original bill and forms 1.08P = 486.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q3": {
          "sourcePrompt": "材料先減重 10%，再吸水增重 15%。相對最初淨增加多少百分比？",
          "sourceKey": "[\"乘數 0.90×1.15=1.035；3.5。\",[\"method\",\"乘數 0.90×1.15=1.035\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Successive percentage changes",
          "prompt": "A material first loses 10% of its mass, then absorbs water and gains 15% of its reduced mass. What is the net percentage increase relative to its original mass?",
          "solution": "The combined multiplier is 0.90 × 1.15 = 1.035. The final mass is 103.5% of the original, a net increase of 3.5%.",
          "criteria": {
            "method": "Multiplies the two factors to obtain 0.90 × 1.15 = 1.035.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q4": {
          "sourcePrompt": "訂單 560 元先打八五折，再扣 30 元積分。最後應付多少元？",
          "sourceKey": "[\"560×0.85−30；446。\",[\"method\",\"560×0.85−30\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Order of discounts",
          "prompt": "A 15% discount is applied to an order worth $560. Reward points are then used to take a further $30 off. How much is paid, in dollars?",
          "solution": "Apply the percentage discount first, then subtract the value of the reward points. The final amount is 560 × 0.85 − 30 = $446.",
          "criteria": {
            "method": "Applies the discounts in order using 560 × 0.85 − 30.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q5": {
          "sourcePrompt": "一批花以 540 元出售，較成本虧損 60 元。虧損佔成本百分之幾？",
          "sourceKey": "[\"成本 600，60÷600×100；10。\",[\"method\",\"成本 600，60÷600×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Profit and loss",
          "prompt": "A batch of flowers sells for $540 at a loss of $60. What is the loss as a percentage of the cost?",
          "solution": "The cost was 540 + 60 = $600. The percentage loss is 60 ÷ 600 × 100% = 10%.",
          "criteria": {
            "method": "Finds the cost as $600 and uses 60 ÷ 600 × 100.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q6": {
          "sourcePrompt": "貨品成本為 315 元，優惠期提供七五折，目標是仍賺成本的 10%。標價多少元？",
          "sourceKey": "[\"315×1.10÷0.75；462。\",[\"method\",\"315×1.10÷0.75\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Finding the marked price",
          "prompt": "An item costs $315. During a promotion it will be sold at a 25% discount on its marked price. The target profit is 10% of the cost. What should the marked price be, in dollars?",
          "solution": "The target selling price is 315 × 1.10 = $346.50. It represents 75% of the marked price, so the marked price should be 346.50 ÷ 0.75 = $462.",
          "criteria": {
            "method": "Uses 315 × 1.10 ÷ 0.75 to obtain the marked price.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q7": {
          "sourcePrompt": "不合格率由 16% 降至 12%。寫出下降的百分點及相對減幅。",
          "sourceKey": "[\"以原比率 16% 為基數，4÷16=0.25；下降 4 個百分點，相對減幅 25%。\",[\"method\",\"以原比率 16% 為基數，4÷16=0.25\",1,\"manual\"],[\"answer\",\"下降 4 個百分點，相對減幅 25%\",1,\"manual\"]]",
          "topic": "Percentage points",
          "prompt": "The failure rate falls from 16% to 12%. Give the decrease in percentage points and the relative percentage decrease.",
          "solution": "The rate falls by 16 − 12 = 4 percentage points. Relative to the original rate of 16%, the decrease is (4 ÷ 16) × 100% = 25%.",
          "criteria": {
            "method": "Uses the original rate of 16% as the base and obtains 4 ÷ 16 = 0.25.",
            "answer": "Gives a fall of 4 percentage points and a relative decrease of 25%."
          }
        },
        "q8": {
          "sourcePrompt": "早場 80 名觀眾有 75% 滿意，晚場 120 名有 90% 滿意。整體滿意率是多少百分比？",
          "sourceKey": "[\"(60＋108)÷200×100；84。\",[\"method\",\"(60＋108)÷200×100\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Combining percentages",
          "prompt": "At an early performance, 75% of the 80 audience members were satisfied. At a later performance, 90% of the 120 audience members were satisfied. What was the overall satisfaction rate across both performances?",
          "solution": "The numbers satisfied were 80 × 75% = 60 and 120 × 90% = 108. The overall rate is (60 + 108) ÷ 200 × 100% = 84%.",
          "criteria": {
            "method": "Combines the two satisfied groups and uses (60 + 108) ÷ 200 × 100.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q9": {
          "sourcePrompt": "某筆存款按年單利 4% 存了 9 個月，獲利息 150 元。求本金（元）。",
          "sourceKey": "[\"設本金 P，P×0.04×9/12=150；5000。\",[\"method\",\"設本金 P，P×0.04×9/12=150\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Simple interest",
          "prompt": "A deposit earns $150 in simple interest over 9 months at 4% per annum. Find the principal, in dollars.",
          "solution": "Let the principal be $P. From P × 0.04 × (9/12) = 150, we get P = 150 ÷ 0.03 = 5,000. The principal is $5,000.",
          "criteria": {
            "method": "Defines the principal P and uses P × 0.04 × (9/12) = 150.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q10": {
          "sourcePrompt": "網店售 420 元商品打九折另加 18 元運費；實體店原價相同減 30 元。較便宜的方案可省多少元？",
          "sourceKey": "[\"網店付 396，實體店付 390；6。\",[\"method\",\"網店付 396，實體店付 390\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Comparing offers",
          "prompt": "An online shop gives a 10% discount on a $420 item and adds an $18 delivery charge. A physical shop reduces the same marked price by $30. How much can you save, in dollars, by choosing the cheaper offer?",
          "solution": "The online price including delivery is 420 × 0.9 + 18 = $396. The physical shop charges 420 − 30 = $390. Choosing the physical shop saves $6.",
          "criteria": {
            "method": "Finds the online total as $396 and the price at the physical shop as $390.",
            "answer": "Gives the correct numerical answer."
          }
        },
        "q11": {
          "sourcePrompt": "有人說每件貨以成本加價 25% 出售，所以利潤佔售價 25%。判斷並用例子解釋。",
          "sourceKey": "[\"以成本 100 元計，利潤 25 元，售價 125 元；錯；利潤佔售價 20%。\",[\"method\",\"以成本 100 元計，利潤 25 元，售價 125 元\",1,\"manual\"],[\"answer\",\"錯；利潤佔售價 20%\",1,\"manual\"]]",
          "topic": "Checking percentage reasoning",
          "prompt": "A trader marks up every item by 25% of its cost. A student concludes that the profit is 25% of the selling price. Decide whether the conclusion is correct and explain using an example.",
          "solution": "For example, an item costing $100 makes a profit of $25 and sells for $125. The profit is 25 ÷ 125 × 100% = 20% of the selling price, so the conclusion is incorrect.",
          "criteria": {
            "method": "Uses an equivalent example, such as a $100 cost, $25 profit and $125 selling price.",
            "answer": "Rejects the conclusion and gives the profit as 20% of the selling price."
          }
        },
        "q12": {
          "sourcePrompt": "義賣每張卡售 16 元，須撥出售價的 12.5% 支付平台費，每張製作費 8 元。要抵銷印版費 210 元，須售出多少張？",
          "sourceKey": "[\"每張淨貢獻=16×0.875−8=6，210÷6；35。\",[\"method\",\"每張淨貢獻=16×0.875−8=6，210÷6\",1,\"manual\"],[\"answer\",\"數值正確\",1,\"auto\"]]",
          "topic": "Break-even sales",
          "prompt": "At a charity sale, each card sells for $16. A platform fee takes 12.5% of the selling price and each card costs $8 to make. How many cards must be sold to cover the $210 printing plate fee?",
          "solution": "Each card contributes 16 × 0.875 − 8 = $6 towards the printing plate fee. The number of cards needed is 210 ÷ 6 = 35.",
          "criteria": {
            "method": "Finds the contribution per card as 16 × 0.875 − 8 = 6 and divides 210 by 6.",
            "answer": "Gives the correct numerical answer."
          }
        }
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = papers;
  root.EduFlowMathsEnglish = papers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
