.PHONY: help install test test-watch test-coverage test-verbose test-new test-db-util test-logger-wrapper test-auth-config test-app clean start zip

# テスト実行に必要なファイルリスト
TEST_FILES = \
	tests/app.test.js \
	tests/config/auth-config.test.js \
	tests/util/logger-wrapper.test.js \
	tests/util/hm-util.test.js \
	tests/models/db-util.test.js \
	tests/models/presence-status.test.js \
	tests/models/place-list.test.js \
	tests/models/telework.test.js \
	tests/models/api-auth.test.js \
	tests/models/login-auth.test.js \
	tests/models/geolocation.test.js \
	tests/models/department.test.js \
	tests/models/user-info.test.js \
	tests/models/whereabouts.test.js

SOURCE_FILES = \
	app.js \
	config/auth-config.js \
	config/log4js-config.json \
	util/logger-wrapper.js \
	util/hm-util.js \
	models/db-util.js \
	models/presence-status.js \
	models/place-list.js \
	models/telework.js \
	models/api-auth.js \
	models/login-auth.js \
	models/geolocation.js \
	models/department.js \
	models/user-info.js \
	models/whereabouts.js

CONFIG_FILES = \
	package.json \
	jest.config.js \
	Makefile

SUPPORT_DIRS = \
	bin \
	routes \
	views \
	public

# zipアーカイブファイル名（上書き可能）
ZIP_FILE ?= heresme-sv-tests.zip

# デフォルトターゲット
help:
	@echo "Available targets:"
	@echo "  make install             - Install all dependencies"
	@echo "  make test                - Run all tests"
	@echo "  make test-watch          - Run tests in watch mode"
	@echo "  make test-coverage       - Run tests with coverage report"
	@echo "  make test-verbose        - Run tests in verbose mode"
	@echo ""
	@echo "New tests (step-by-step execution):"
	@echo "  make test-new            - Run all 4 newly created tests"
	@echo "  make test-db-util        - Run db-util.test.js only"
	@echo "  make test-logger-wrapper - Run logger-wrapper.test.js only"
	@echo "  make test-auth-config    - Run auth-config.test.js only"
	@echo "  make test-app            - Run app.test.js only"
	@echo ""
	@echo "  make start               - Start the application in development mode"
	@echo "  make zip                 - Create test archive (ZIP_FILE=heresme-sv-tests.zip)"
	@echo "  make clean               - Clean node_modules, lock files and zip archives"

# 依存パッケージのインストール
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Installation completed!"

# テスト実行
test:
	@echo "Running tests..."
	npm test

# テスト実行（watch mode）
test-watch:
	@echo "Running tests in watch mode..."
	npm run test:watch

# テスト実行（カバレッジ付き）
test-coverage:
	@echo "Running tests with coverage..."
	npm run test:coverage

# テスト実行（verbose mode）
test-verbose:
	@echo "Running tests in verbose mode..."
	npm run test:verbose

# 新規作成テストの実行（段階的アプローチ用）
test-new:
	@echo "Running newly created tests (4 files)..."
	@echo "1/4: Testing db-util.test.js"
	npx jest tests/models/db-util.test.js
	@echo ""
	@echo "2/4: Testing logger-wrapper.test.js"
	npx jest tests/util/logger-wrapper.test.js
	@echo ""
	@echo "3/4: Testing auth-config.test.js"
	npx jest tests/config/auth-config.test.js
	@echo ""
	@echo "4/4: Testing app.test.js"
	npx jest tests/app.test.js
	@echo ""
	@echo "All new tests completed!"

# 個別テスト実行
test-db-util:
	@echo "Testing db-util.test.js..."
	npx jest tests/models/db-util.test.js

test-logger-wrapper:
	@echo "Testing logger-wrapper.test.js..."
	npx jest tests/util/logger-wrapper.test.js

test-auth-config:
	@echo "Testing auth-config.test.js..."
	npx jest tests/config/auth-config.test.js

test-app:
	@echo "Testing app.test.js..."
	npx jest tests/app.test.js

# アプリケーション起動
start:
	@echo "Starting application..."
	npm start

# クリーンアップ
clean:
	@echo "Cleaning up..."
	rm -rf node_modules
	rm -f package-lock.json
	rm -f *.zip
	@echo "Cleanup completed!"

# テスト用zipアーカイブ作成
zip:
	@echo "Creating test archive: $(ZIP_FILE)"
	@rm -f $(ZIP_FILE)
	zip -r $(ZIP_FILE) $(TEST_FILES) $(SOURCE_FILES) $(CONFIG_FILES) $(SUPPORT_DIRS)
	@echo "Archive created: $(ZIP_FILE)"
	@echo "Files included: $(words $(TEST_FILES)) test files, $(words $(SOURCE_FILES)) source files"
