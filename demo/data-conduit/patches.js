// 敵対的検証（2026-08-13）で断定された誤りの修正。根拠は各コメントの ファイル:行。
module.exports = {
  dropEdges: [
    // 【誤り1】デコレータ順の逆転: @use_kwargs のデシリアライズは view 本体より先に走る
    // （views.py:39-43 / 57-61 / 146-150。デコレータはボトムアップ適用）。
    // view→schema の同一ペアが「検証」と「シリアライズ」で二重登録されており、
    // ビルド時のフロー内重複排除で後者が消える問題も併発していたため、ペアごと畳んで貼り直す。
    ['api.articles.make_article', 'svc.schema.article_schema'],
    ['svc.auth.jwt_required', 'api.articles.make_article'],
    ['api.articles.update_article', 'svc.schema.article_schema'],
    ['svc.auth.jwt_required', 'api.articles.update_article'],
    ['api.articles.make_comment_on_article', 'svc.schema.comment_schema'],
    ['svc.auth.jwt_required', 'api.articles.make_comment_on_article'],
    // 【誤り2】feed は followers_assoc（profile 側定義の中間表）経由で読む
    // （articles/views.py:119 の current_user.profile.follows は profile/models.py:20-25 の
    //  secondary=followers_assoc）。直結だとフォロー→フィードの合流が図から消える。
    ['api.articles.articles_feed', 'db.userprofile'],
  ],
  addEdges: [
    // create-article: http受信 → 認証 → デシリアライズ → view 実行
    { from: 'svc.auth.jwt_required', to: 'svc.schema.article_schema',
      label: 'POSTボディをデシリアライズ', kind: 'call', flows: ['f-articles:create-article'] },
    { from: 'svc.schema.article_schema', to: 'api.articles.make_article',
      label: 'デシリアライズ済み引数で実行', kind: 'call', flows: ['f-articles:create-article'] },
    // update-article: 同型
    { from: 'svc.auth.jwt_required', to: 'svc.schema.article_schema',
      label: 'PUTボディをデシリアライズ', kind: 'call', flows: ['f-articles:update-article'] },
    { from: 'svc.schema.article_schema', to: 'api.articles.update_article',
      label: 'デシリアライズ済み引数で実行', kind: 'call', flows: ['f-articles:update-article'] },
    // create-comment: 同型
    { from: 'svc.auth.jwt_required', to: 'svc.schema.comment_schema',
      label: 'POSTボディをデシリアライズ', kind: 'call', flows: ['f-articles:create-comment'] },
    { from: 'svc.schema.comment_schema', to: 'api.articles.make_comment_on_article',
      label: 'デシリアライズ済み引数で実行', kind: 'call', flows: ['f-articles:create-comment'] },
    // articles-feed: followers_assoc 経由に修正（ノード定義は f-user.json 側にあり、ビルドで合流する）
    { from: 'api.articles.articles_feed', to: 'db.followers_assoc',
      label: 'current_user.profile.follows で結合', kind: 'db', flows: ['f-articles:articles-feed'] },
    { from: 'db.followers_assoc', to: 'db.userprofile',
      label: 'フォロー中プロフィールへ結合', kind: 'db', flows: ['f-articles:articles-feed'] },
  ],
  nodePatch: {
    // 【誤り3】ハブ指定時の ref が jwt = JWTManager() の行（extensions.py:48）を指していた。
    // jwt_required は flask_jwt_extended からの直輸入でリポジトリ内に定義が無い。代表的な適用行に修正。
    'svc.auth.jwt_required': {
      ref: 'conduit/user/views.py:44',
      detail: 'flask_jwt_extended の @jwt_required。リポジトリ内に定義は無く各 views で直輸入。ref は代表的な適用行',
    },
  },
  flowPatch: {
    // 【誤り4】「このエンドポイントのみ認証なし」は過剰主張。get_tags（views.py:127-129）も認証なし。
    'f-articles:get-comments': {
      notesDrop: ['このエンドポイントのみ'],
      notesAdd: ['認証デコレータ無しで未ログイン閲覧できるのは、この GET コメントと GET /api/tags（get_tags）の2つ'],
    },
    // marshal_with のシリアライズはデコレータで暗黙に走る（貼り直しで明示ステップを畳んだ分の補足）
    'f-articles:create-article': { notesAdd: ['応答は @marshal_with(article_schema) が暗黙にシリアライズして返す'] },
    'f-articles:update-article': { notesAdd: ['応答は @marshal_with(article_schema) が暗黙にシリアライズして返す'] },
    'f-articles:create-comment': { notesAdd: ['応答は @marshal_with(comment_schema) が暗黙にシリアライズして返す'] },
  },
};
