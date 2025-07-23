// グローバル変数
window.entities = null;
window.properties = null;
window.propertiesWithLabels = null;
window.propertyValues = null;
window.entitiesWithValue = null;
window.entitiesWithoutValue = null;
window.currentCorrectAnswer = null;
window.currentSelectedAnswer = null;

// SPARQL クエリを送信する関数
async function sendSPARQLQuery(endpoint, query) {
  const url = endpoint + "?query=" + encodeURIComponent(query) + "&format=json";
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("SPARQL query error:", error);
    throw error;
  }
}

// デモ開始
async function startDemo() {
  const classID = document.getElementById("classID").value;
  const endpoint = "https://query.wikidata.org/sparql";

  // 結果をクリア
  clearResults();

  try {
    await stage1(endpoint, classID);
    await stage2(endpoint);
    await stage3(endpoint);
  } catch (error) {
    document.getElementById("result1").innerHTML =
      '<div class="error">エラー: ' + error.message + "</div>";
  }
}

// 結果をクリアする関数
function clearResults() {
  document.getElementById("result1").innerHTML = "";
  document.getElementById("result2").innerHTML = "";
  document.getElementById("result3").innerHTML = "";
  document.getElementById("result4").innerHTML = "";
  document.getElementById("result5a").innerHTML = "";
  document.getElementById("result5b").innerHTML = "";
  document.getElementById("result6").innerHTML = "";
}

// 第1段階: エンティティの取得
async function stage1(endpoint, classID) {
  const resultDiv = document.getElementById("result1");
  resultDiv.innerHTML = '<div class="loading">クエリを実行中...</div>';

  const query1 = `SELECT ?s WHERE {?s wdt:P31 wd:${classID} .} LIMIT 100`;
  document.getElementById("query1").textContent = query1;

  const result = await sendSPARQLQuery(endpoint, query1);
  const entities = result.results.bindings;

  let html = '<div class="result-box">';
  html += `<strong>取得結果: ${entities.length}件</strong><br><div style="max-height:200px;overflow-y:auto;">`;

  entities.slice(0, 10).forEach((e, i) => {
    const id = e.s.value.replace("http://www.wikidata.org/entity/", "");
    html += `${i + 1}. <a href="${e.s.value}" target="_blank">${id}</a><br>`;
  });

  if (entities.length > 10) html += `... 他${entities.length - 10}件`;
  html += "</div></div>";

  resultDiv.innerHTML = html;
  window.entities = entities;
}

// 第2段階: プロパティ使用頻度の集計
async function stage2(endpoint) {
  const resultDiv = document.getElementById("result2");
  resultDiv.innerHTML = '<div class="loading">クエリを実行中...</div>';

  const ids = window.entities
    .map((x) => x.s.value.replace("http://www.wikidata.org/entity/", "wd:"))
    .join(" ");

  const query2 = `SELECT ?p (count(?s) AS ?c)
WHERE {?s ?p ?o. VALUES ?s {${ids}} ?prop wikibase:directClaim ?p. FILTER (isIRI(?o)) }
GROUP BY ?p ORDER BY DESC(?c) LIMIT 16`;

  document.getElementById("query2").textContent = query2;

  const result = await sendSPARQLQuery(endpoint, query2);
  const properties = result.results.bindings;

  let html =
    '<div class="result-box"><strong>プロパティ使用頻度</strong><br><table style="width:100%;border-collapse:collapse;"><tr><th style="border:1px solid #ddd;padding:5px;">プロパティ</th><th style="border:1px solid #ddd;padding:5px;">使用回数</th></tr>';

  properties.forEach((p) => {
    const id = p.p.value.replace("http://www.wikidata.org/prop/direct/", "");
    html += `<tr><td style="border:1px solid #ddd;padding:5px;"><a href="${p.p.value}" target="_blank">${id}</a></td><td style="border:1px solid #ddd;padding:5px;text-align:center;">${p.c.value}</td></tr>`;
  });

  html += "</table></div>";
  resultDiv.innerHTML = html;
  window.properties = properties;
}

// 第3段階: プロパティラベルの取得
async function stage3(endpoint) {
  const resultDiv = document.getElementById("result3");
  resultDiv.innerHTML = '<div class="loading">クエリを実行中...</div>';

  const pIDs = window.properties
    .map((x) =>
      x.p.value.replace("http://www.wikidata.org/prop/direct/", "wdt:")
    )
    .join(" ");

  const query3 = `SELECT ?p ?pLabel ?propLabel WHERE { 
VALUES ?p {${pIDs}} 
FILTER NOT EXISTS {?prop wdt:P31 wd:Q26940804}
FILTER NOT EXISTS {?prop wdt:P31 wd:Q84764641}
FILTER NOT EXISTS {?prop wdt:P1629 wd:Q26987229}
FILTER NOT EXISTS {?prop wdt:P1629 wd:Q184377}
FILTER NOT EXISTS {?prop wdt:P31 wd:Q103824108}
?prop wikibase:directClaim ?p .
SERVICE wikibase:label { bd:serviceParam wikibase:language "ja, en". }
}`;

  document.getElementById("query3").textContent = query3;

  const result = await sendSPARQLQuery(endpoint, query3);
  const labels = result.results.bindings;

  let html =
    '<div class="result-box"><strong>プロパティラベル情報</strong><br><table style="width:100%;border-collapse:collapse;"><tr><th style="border:1px solid #ddd;padding:5px;">プロパティ</th><th style="border:1px solid #ddd;padding:5px;">ラベル</th><th style="border:1px solid #ddd;padding:5px;">使用回数</th></tr>';

  const propertySelect = document.getElementById("propertySelect");
  propertySelect.innerHTML = '<option value="">プロパティを選択...</option>';

  labels.forEach((label) => {
    const id = label.p.value.replace(
      "http://www.wikidata.org/prop/direct/",
      ""
    );
    const labelText = label.propLabel ? label.propLabel.value : "ラベルなし";
    const usage = window.properties.find((p) => p.p.value === label.p.value);
    const count = usage ? usage.c.value : "0";

    html += `<tr><td style="border:1px solid #ddd;padding:5px;"><a href="${label.p.value}" target="_blank">${id}</a></td><td style="border:1px solid #ddd;padding:5px;">${labelText}</td><td style="border:1px solid #ddd;padding:5px;text-align:center;">${count}</td></tr>`;

    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${id} - ${labelText} (${count}回)`;
    propertySelect.appendChild(option);
  });

  html += "</table></div>";
  resultDiv.innerHTML = html;
  window.propertiesWithLabels = labels;
}

// 第4段階: 選択したプロパティの値一覧
async function stage4() {
  const endpoint = "https://query.wikidata.org/sparql";
  const selectedProperty = document.getElementById("propertySelect").value;

  if (!selectedProperty) {
    alert("プロパティを選択してください");
    return;
  }

  if (!window.entities) {
    alert("まず第1段階を実行してください");
    return;
  }

  document.getElementById("propertyID").value = selectedProperty;

  const resultDiv = document.getElementById("result4");
  resultDiv.innerHTML = '<div class="loading">クエリを実行中...</div>';

  const entityList = window.entities
    .map((x) => x.s.value.replace("http://www.wikidata.org/entity/", "wd:"))
    .join(" ");

  const query4 = `SELECT ?o ?oLabel (COUNT(?s) AS ?c) WHERE {
  ?s wdt:${selectedProperty} ?o.
  VALUES ?s { ${entityList} }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
GROUP BY ?o ?oLabel
ORDER BY DESC(?c)
LIMIT 20`;

  document.getElementById("query4").textContent = query4;

  try {
    const result = await sendSPARQLQuery(endpoint, query4);
    const values = result.results.bindings;

    const valueSelect = document.getElementById("valueSelect");
    valueSelect.innerHTML = '<option value="">値を選択...</option>';

    let html = `<div class="result-box"><strong>${selectedProperty}の値一覧 (${values.length}件)</strong><br>`;
    html +=
      '<table style="width:100%;border-collapse:collapse;"><tr><th style="border:1px solid #ddd;padding:5px;">値</th><th style="border:1px solid #ddd;padding:5px;">ラベル</th><th style="border:1px solid #ddd;padding:5px;">使用回数</th></tr>';

    values.forEach((value) => {
      const id = value.o.value.replace("http://www.wikidata.org/entity/", "");
      const labelText = value.oLabel ? value.oLabel.value : "ラベルなし";
      const count = value.c.value;

      html += `<tr><td style="border:1px solid #ddd;padding:5px;"><a href="${value.o.value}" target="_blank">${id}</a></td><td style="border:1px solid #ddd;padding:5px;">${labelText}</td><td style="border:1px solid #ddd;padding:5px;text-align:center;">${count}</td></tr>`;

      const option = document.createElement("option");
      option.value = id;
      option.textContent = `${id} - ${labelText} (${count}回)`;
      valueSelect.appendChild(option);
    });

    html += "</table></div>";
    resultDiv.innerHTML = html;

    window.propertyValues = values;
  } catch (error) {
    resultDiv.innerHTML =
      '<div class="error">エラー: ' + error.message + "</div>";
  }
}

// 第5段階: ある・なしの比較
async function stage5() {
  const endpoint = "https://query.wikidata.org/sparql";
  const classID = document.getElementById("classID").value;
  const propertyID = document.getElementById("propertyID").value;
  const valueID = document.getElementById("valueSelect").value;

  if (!valueID) {
    alert("値を選択してください");
    return;
  }

  const resultDivA = document.getElementById("result5a");
  const resultDivB = document.getElementById("result5b");
  resultDivA.innerHTML =
    '<div class="loading">「ある」のクエリを実行中...</div>';
  resultDivB.innerHTML =
    '<div class="loading">「なし」のクエリを実行中...</div>';

  const query5a = `
SELECT ?entity ?entityLabel WHERE {
  ?entity wdt:P31 wd:${classID} .
  ?entity wdt:${propertyID} wd:${valueID} .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
LIMIT 100`;

  const query5b = `
SELECT ?entity ?entityLabel WHERE {
  ?entity wdt:P31 wd:${classID} .
  FILTER NOT EXISTS { ?entity wdt:${propertyID} wd:${valueID} . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
LIMIT 100`;

  document.getElementById("query5a").textContent = query5a;
  document.getElementById("query5b").textContent = query5b;

  try {
    const [resultA, resultB] = await Promise.all([
      sendSPARQLQuery(endpoint, query5a),
      sendSPARQLQuery(endpoint, query5b),
    ]);

    const formatResult = (bindings, label) => {
      let html = `<div class="result-box"><strong>${label} (${bindings.length}件)</strong><ul style="max-height:300px;overflow-y:auto;">`;
      bindings.forEach((b) => (html += `<li>${b.entityLabel.value}</li>`));
      html += "</ul></div>";
      return html;
    };

    resultDivA.innerHTML = formatResult(
      resultA.results.bindings,
      "指定された値を「持つ」エンティティ"
    );
    resultDivB.innerHTML = formatResult(
      resultB.results.bindings,
      "指定された値を「持たない」エンティティ"
    );

    // 第6段階用にデータを保存
    window.entitiesWithValue = resultA.results.bindings;
    window.entitiesWithoutValue = resultB.results.bindings;
  } catch (error) {
    resultDivA.innerHTML =
      '<div class="error">エラー（ある）: ' + error.message + "</div>";
    resultDivB.innerHTML =
      '<div class="error">エラー（なし）: ' + error.message + "</div>";
  }
}

// ランダムに要素を取得する関数
function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 第6段階: 問題生成
function stage6() {
  if (!window.entitiesWithValue || !window.entitiesWithoutValue) {
    alert("まず第5段階を実行してください");
    return;
  }

  const withValue = window.entitiesWithValue;
  const withoutValue = window.entitiesWithoutValue;

  if (withValue.length < 3 || withoutValue.length < 1) {
    document.getElementById("result6").innerHTML =
      '<div class="error">問題を生成するのに十分なデータがありません。「ある」グループに3件以上、「なし」グループに1件以上必要です。</div>';
    return;
  }

  // ランダムに選択する: 「ある」から3つ、「なし」から1つ、または逆パターン
  const usePattern1 = Math.random() < 0.5; // 50%の確率でパターンを選択
  let options = [];
  let correctAnswer = "";
  let questionType = "";

  if (usePattern1) {
    // パターン1: 「ある」から3つ、「なし」から1つ
    const selectedWithValue = getRandomElements(withValue, 3);
    const selectedWithoutValue = getRandomElements(withoutValue, 1);
    options = [...selectedWithValue, ...selectedWithoutValue];
    correctAnswer = selectedWithoutValue[0].entityLabel.value;
    questionType = "持たない";
  } else {
    // パターン2: 「ある」から1つ、「なし」から3つ
    const selectedWithValue = getRandomElements(withValue, 1);
    const selectedWithoutValue = getRandomElements(withoutValue, 3);
    options = [...selectedWithValue, ...selectedWithoutValue];
    correctAnswer = selectedWithValue[0].entityLabel.value;
    questionType = "持つ";
  }

  // 選択肢をシャッフル
  options.sort(() => 0.5 - Math.random());

  // プロパティと値の情報を取得
  const propertyID = document.getElementById("propertyID").value;
  const valueID = document.getElementById("valueSelect").value;
  const propertyLabel =
    window.propertiesWithLabels?.find((p) => p.p.value.includes(propertyID))
      ?.propLabel?.value || propertyID;
  const valueLabel =
    window.propertyValues?.find((v) => v.o.value.includes(valueID))?.oLabel
      ?.value || valueID;

  // 問題を生成
  generateQuizHTML(
    options,
    correctAnswer,
    questionType,
    propertyLabel,
    valueLabel
  );
}

// クイズのHTMLを生成する関数
function generateQuizHTML(
  options,
  correctAnswer,
  questionType,
  propertyLabel,
  valueLabel
) {
  const resultDiv = document.getElementById("result6");

  let html = '<div class="quiz-container">';
  html += `<div class="quiz-question">Q. 次のうち、「${propertyLabel}」が「${valueLabel}」である特徴を${questionType}のはどれ？</div>`;
  html += '<div class="quiz-options" id="quizOptions">';

  options.forEach((option, index) => {
    const label = option.entityLabel.value;
    html += `<div class="quiz-option" onclick="selectOption(this, '${label}')" data-value="${label}">
      ${String.fromCharCode(65 + index)}. ${label}
    </div>`;
  });

  html += "</div>";
  html += '<div class="quiz-buttons">';
  html += '<button onclick="checkAnswer()">答えを確認</button>';
  html += '<button onclick="stage6()">新しい問題を生成</button>';
  html += "</div>";
  html += '<div id="quizAnswer"></div>';
  html += "</div>";

  resultDiv.innerHTML = html;

  // グローバル変数に正解を保存
  window.currentCorrectAnswer = correctAnswer;
  window.currentSelectedAnswer = null;
}

// 選択肢を選択する関数
function selectOption(element, value) {
  // 全ての選択肢からselectedクラスを削除
  document.querySelectorAll(".quiz-option").forEach((opt) => {
    opt.classList.remove("selected");
  });

  // クリックされた選択肢にselectedクラスを追加
  element.classList.add("selected");
  window.currentSelectedAnswer = value;
}

// 答えを確認する関数
function checkAnswer() {
  if (!window.currentSelectedAnswer) {
    alert("選択肢を選んでください");
    return;
  }

  const isCorrect =
    window.currentSelectedAnswer === window.currentCorrectAnswer;
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((option) => {
    const value = option.getAttribute("data-value");
    if (value === window.currentCorrectAnswer) {
      option.classList.add("correct");
    } else if (value === window.currentSelectedAnswer && !isCorrect) {
      option.classList.add("incorrect");
    }
    option.onclick = null; // クリックを無効化
  });

  const answerDiv = document.getElementById("quizAnswer");
  if (isCorrect) {
    answerDiv.innerHTML =
      '<div class="quiz-answer" style="background:#e8f5e8;border-color:#4caf50;"><strong>正解！</strong> よくできました。</div>';
  } else {
    answerDiv.innerHTML = `<div class="quiz-answer" style="background:#ffebee;border-color:#f44336;"><strong>不正解</strong><br>正解は「${window.currentCorrectAnswer}」でした。</div>`;
  }
}
