#!/usr/bin/env node

/**
 * 修复数据库中错误的 sender_name 字段
 * 
 * 问题：私聊消息不应该有 sender_name，只有群聊消息才应该有
 * 判断标准：user_id 中包含 @ 符号的是群聊，否则是私聊
 * 
 * 使用方法：
 * node scripts/fix-sender-name.js
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取 .vego 目录下的所有 workspace
function getWorkspaces() {
  const vegoDir = path.join(process.cwd(), '.vego');
  
  if (!fs.existsSync(vegoDir)) {
    console.error('❌ .vego 目录不存在');
    return [];
  }
  
  const entries = fs.readdirSync(vegoDir, { withFileTypes: true });
  const workspaces = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('workspace_'))
    .map(entry => ({
      name: entry.name.replace('workspace_', ''),
      path: path.join(vegoDir, entry.name),
      dbPath: path.join(vegoDir, entry.name, 'memory.db'),
    }))
    .filter(ws => fs.existsSync(ws.dbPath));
  
  return workspaces;
}

// 修复单个数据库
function fixDatabase(workspace) {
  console.log(`\n📂 处理角色: ${workspace.name}`);
  console.log(`   数据库: ${workspace.dbPath}`);
  
  const db = new Database(workspace.dbPath);
  
  try {
    // 检查是否有 sender_name 列
    const columns = db.pragma('table_info(messages)');
    const hasSenderName = columns.some(col => col.name === 'sender_name');
    
    if (!hasSenderName) {
      console.log('   ⚠️  数据库没有 sender_name 列，跳过');
      return;
    }
    
    // 查询所有 user_id 不包含 @ 但有 sender_name 的记录
    const wrongRecords = db.prepare(`
      SELECT id, user_id, sender_name, platform
      FROM messages
      WHERE sender_name IS NOT NULL
        AND user_id NOT LIKE '%@%'
    `).all();
    
    if (wrongRecords.length === 0) {
      console.log('   ✅ 没有需要修复的记录');
      return;
    }
    
    console.log(`   🔍 找到 ${wrongRecords.length} 条需要修复的记录`);
    
    // 显示前几条示例
    console.log('   示例记录:');
    wrongRecords.slice(0, 3).forEach(record => {
      console.log(`      ID: ${record.id}, user_id: ${record.user_id}, sender_name: ${record.sender_name}, platform: ${record.platform}`);
    });
    
    // 询问是否继续
    console.log(`\n   ⚠️  将清除这些私聊消息的 sender_name 字段`);
    
    // 执行修复
    const updateStmt = db.prepare(`
      UPDATE messages
      SET sender_name = NULL
      WHERE sender_name IS NOT NULL
        AND user_id NOT LIKE '%@%'
    `);
    
    const result = updateStmt.run();
    console.log(`   ✅ 已修复 ${result.changes} 条记录`);
    
    // 验证修复结果
    const remainingWrong = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE sender_name IS NOT NULL
        AND user_id NOT LIKE '%@%'
    `).get();
    
    if (remainingWrong.count === 0) {
      console.log('   ✅ 验证通过：所有私聊消息的 sender_name 已清除');
    } else {
      console.log(`   ⚠️  仍有 ${remainingWrong.count} 条记录未修复`);
    }
    
    // 显示群聊消息统计
    const groupMessages = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE user_id LIKE '%@%'
    `).get();
    
    const groupWithSender = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE user_id LIKE '%@%'
        AND sender_name IS NOT NULL
    `).get();
    
    console.log(`   📊 群聊消息统计: 总计 ${groupMessages.count} 条，其中 ${groupWithSender.count} 条有 sender_name`);
    
  } catch (error) {
    console.error(`   ❌ 处理失败:`, error.message);
  } finally {
    db.close();
  }
}

// 主函数
function main() {
  console.log('🔧 开始修复 sender_name 字段...\n');
  
  const workspaces = getWorkspaces();
  
  if (workspaces.length === 0) {
    console.log('❌ 没有找到任何工作区');
    return;
  }
  
  console.log(`找到 ${workspaces.length} 个工作区:`);
  workspaces.forEach(ws => {
    console.log(`  - ${ws.name}`);
  });
  
  // 处理每个工作区
  workspaces.forEach(workspace => {
    fixDatabase(workspace);
  });
  
  console.log('\n✅ 所有工作区处理完成！');
  console.log('\n说明:');
  console.log('  - 私聊消息 (user_id 不包含 @) 的 sender_name 已被清除');
  console.log('  - 群聊消息 (user_id 包含 @) 的 sender_name 保持不变');
  console.log('  - 这样 Web 界面就不会错误地显示群聊标记了');
}

main();
