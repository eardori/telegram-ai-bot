const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function analyzePrompts() {
  console.log('📊 프롬프트 템플릿 구조 분석\n');
  console.log('='.repeat(80));

  const { data: templates, error: templatesError } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('category', { ascending: true })
    .order('priority', { ascending: false });

  if (templatesError) {
    console.error('❌ Error:', templatesError);
    return;
  }

  const byCategory = {};
  templates.forEach(t => {
    if (!byCategory[t.category]) {
      byCategory[t.category] = [];
    }
    byCategory[t.category].push(t);
  });

  const categoryNames = {
    '3d_figurine': '🎭 3D 피규어',
    'portrait_styling': '📸 포트레이트 스타일링',
    'image_editing': '✂️ 이미지 편집',
    'game_animation': '🎮 게임/애니메이션',
    'creative_transform': '🎨 크리에이티브 변환'
  };

  for (const cat of Object.keys(byCategory)) {
    const items = byCategory[cat];
    console.log('\n' + (categoryNames[cat] || cat));
    console.log('-'.repeat(80));

    for (const t of items) {
      const status = t.is_active ? '✅' : '❌';
      const type = t.template_type === 'parameterized' ? '🔧' : '📝';

      console.log(`${status} ${type} ${t.template_name_ko} (${t.template_key})`);
      console.log(`   타입: ${t.template_type}`);
      console.log(`   이미지: ${t.min_images}-${t.max_images}장 | 얼굴: ${t.requires_face ? 'O' : 'X'} | 우선순위: ${t.priority}`);

      if (t.template_type === 'parameterized') {
        const { data: params } = await supabase
          .from('template_parameters')
          .select('*, template_parameter_options(*)')
          .eq('template_key', t.template_key)
          .order('display_order', { ascending: true });

        if (params && params.length > 0) {
          console.log(`   📋 파라미터 (${params.length}개):`);
          params.forEach(p => {
            const optCount = p.template_parameter_options?.length || 0;
            console.log(`     - ${p.parameter_name_ko} (${p.parameter_key}): ${optCount}개 옵션`);
          });
        } else {
          console.log(`   ⚠️  파라미터 없음 (구조 오류)`);
        }
      }
      console.log('');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 통계');
  console.log('='.repeat(80));
  console.log(`전체 템플릿: ${templates.length}개`);
  console.log(`활성화: ${templates.filter(t => t.is_active).length}개`);
  console.log(`파라미터형: ${templates.filter(t => t.template_type === 'parameterized').length}개`);
  console.log(`고정형: ${templates.filter(t => t.template_type === 'fixed').length}개`);

  console.log('\n카테고리별:');
  for (const cat of Object.keys(byCategory)) {
    console.log(`  ${categoryNames[cat]}: ${byCategory[cat].length}개`);
  }

  // 파라미터형 템플릿 상세
  console.log('\n' + '='.repeat(80));
  console.log('🔧 파라미터형 템플릿 상세 분석');
  console.log('='.repeat(80));

  const parameterized = templates.filter(t => t.template_type === 'parameterized');

  for (const t of parameterized) {
    console.log(`\n${t.template_name_ko} (${t.template_key})`);

    const { data: params } = await supabase
      .from('template_parameters')
      .select('*, template_parameter_options(*)')
      .eq('template_key', t.template_key)
      .order('display_order', { ascending: true });

    if (!params || params.length === 0) {
      console.log('  ❌ 파라미터 없음 - 구조 오류!');
      continue;
    }

    params.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.parameter_name_ko} (${p.parameter_key})`);
      console.log(`     타입: ${p.parameter_type} | 필수: ${p.is_required ? 'O' : 'X'}`);

      const options = p.template_parameter_options || [];
      if (options.length === 0) {
        console.log(`     ❌ 옵션 없음 - 구조 오류!`);
      } else {
        console.log(`     옵션 (${options.length}개):`);
        options.slice(0, 5).forEach((opt, optIdx) => {
          console.log(`       ${optIdx + 1}. ${opt.option_name_ko} (${opt.option_key})`);
        });
        if (options.length > 5) {
          console.log(`       ... 외 ${options.length - 5}개`);
        }
      }
    });
  }
}

analyzePrompts().then(() => {
  console.log('\n✅ 분석 완료');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  console.error(err.stack);
  process.exit(1);
});
