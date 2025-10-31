/**
 * Jest設定ファイル
 *
 * heresme-svプロジェクトの単体テスト設定
 */

module.exports = {
  // テスト環境
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // カバレッジ収集対象
  collectCoverageFrom: [
    'models/**/*.js',
    'util/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],

  // カバレッジ出力ディレクトリ
  coverageDirectory: 'coverage',

  // カバレッジレポートの形式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
  ],

  // カバレッジ閾値
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  // モジュール名のマッピング（必要に応じて）
  moduleNameMapper: {},

  // セットアップファイル（必要に応じて）
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // テストタイムアウト（ミリ秒）
  testTimeout: 10000,

  // 詳細な出力
  verbose: true,

  // テスト実行前にモックをクリア
  clearMocks: true,

  // 各テスト前にモックをリセット
  resetMocks: true,

  // 各テスト前にモジュールをリセット
  resetModules: false,
};
