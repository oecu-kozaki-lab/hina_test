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

async function startDemo() {
  const classID = document.getElementById("classID").value;
  const endpoint = "https://query.wikidata.org/sparql";
  ["result1", "result2", "result3", "result4"].forEach((id) => {
    document.getElementById(id).innerHTML = "";
  });
  try {
    await stage1(endpoint, classID);
    await stage2(endpoint);
    await stage3(endpoint);
  } catch (error) {
    document.getElementById("result1").innerHTML =
      '<div class="error">エラー: ' + error.message + "</div>";
  }
}

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

async function stage2(endpoint) {
  const resultDiv = document.getElementById("result2");
  resultDiv.innerHTML = '<div class="loading">クエリを実行中...</div>';
  const ids = window.entities
    .map((x) => x.s.value.replace("http://www.wikidata.org/entity/", "wd:"))
    .join(" ");
  const query2 = `SELECT ?p (count(?s) AS ?c)
WHERE {
  ?s ?p ?o.
  VALUES ?s {${ids}}
  ?prop wikibase:directClaim ?p.
  FILTER(isIRI(?o))
}
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
?prop wikibase:directClaim ?p.
SERVICE wikibase:label { bd:serviceParam wikibase:language "ja, en". }
}`;
  document.getElementById("query3").textContent = query3;
  const result = await sendSPARQLQuery(endpoint, query3);
  const labels = result.results.bindings;

  // プロパティ選択肢を更新
  const propertySelect = document.getElementById("propertySelect");
  propertySelect.innerHTML = '<option value="">プロパティを選択...</option>';

  let html =
    '<div class="result-box"><strong>プロパティラベル情報</strong><br><table style="width:100%;border-collapse:collapse;"><tr><th style="border:1px solid #ddd;padding:5px;">プロパティ</th><th style="border:1px solid #ddd;padding:5px;">ラベル</th><th style="border:1px solid #ddd;padding:5px;">使用回数</th></tr>';
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

async function stage4() {
  const endpoint = "https://query.wikidata.org/sparql";
  const selectedProperty = document.getElementById("propertySelect").value;
  if (!selectedProperty) return alert("プロパティを選択してください");
  if (!window.entities) return alert("まず第1段階を実行してください");
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
    let html = `<div class="result-box"><strong>${selectedProperty}の値一覧 (${values.length}件)</strong><br><table style="width:100%;border-collapse:collapse;"><tr><th style="border:1px solid #ddd;padding:5px;">値</th><th style="border:1px solid #ddd;padding:5px;">ラベル</th><th style="border:1px solid #ddd;padding:5px;text-align:center;">使用回数</th></tr>`;
    values.forEach((v) => {
      const id = v.o.value.replace("http://www.wikidata.org/entity/", "");
      const labelText = v.oLabel ? v.oLabel.value : "ラベルなし";
      const count = v.c.value;
      html += `<tr><td style="border:1px solid #ddd;padding:5px;"><a href="${v.o.value}" target="_blank">${id}</a></td><td style="border:1px solid #ddd;padding:5px;">${labelText}</td><td style="border:1px solid #ddd;padding:5px;text-align:center;">${count}</td></tr>`;
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

async function stage5() {
  const endpoint = "https://query.wikidata.org/sparql";
  const classID = document.getElementById("classID").value;
  const propertyID = document.getElementById("propertyID").value;
  const valueID = document.getElementById("valueSelect").value;
  if (!valueID) return alert("値を選択してください");
  const resultDivA = document.getElementById("result5a");
  const resultDivB = document.getElementById("result5b");
  resultDivA.innerHTML =
    '<div class="loading">「ある」のクエリを実行中...</div>';
  resultDivB.innerHTML =
    '<div class="loading">「なし」のクエリを実行中...</div>';
  const query5a = `
SELECT ?entityLabel WHERE {
  ?entity wdt:P31 wd:${classID} .
  ?entity wdt:${propertyID} wd:${valueID} .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
LIMIT 100`;
  const query5b = `
SELECT ?entityLabel WHERE {
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
    const format = (bindings, label) => {
      let h = `<div class="result-box"><strong>${label} (${bindings.length}件)</strong><ul>`;
      bindings.forEach((b) => (h += `<li>${b.entityLabel.value}</li>`));
      h += "</ul></div>";
      return h;
    };
    resultDivA.innerHTML = format(
      resultA.results.bindings,
      "指定された値を「持つ」エンティティ"
    );
    resultDivB.innerHTML = format(
      resultB.results.bindings,
      "指定された値を「持たない」エンティティ"
    );
  } catch (error) {
    resultDivA.innerHTML =
      '<div class="error">エラー（ある）: ' + error.message + "</div>";
    resultDivB.innerHTML =
      '<div class="error">エラー（なし）: ' + error.message + "</div>";
  }
}
