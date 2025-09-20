-- =============================================================================
-- INSERT 38 PROMPT TEMPLATES
-- Version: 1.0.0
-- Description: Insert all 38 image editing prompt templates with Korean names
-- =============================================================================

-- Clear existing templates (optional - remove in production)
-- TRUNCATE TABLE prompt_templates RESTART IDENTITY CASCADE;

-- =============================================================================
-- CATEGORY: 3D/FIGURINE (3d_figurine) - Templates 1, 13, 14, 15, 16
-- =============================================================================

-- Template 1: 피규어 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt, example_prompt,
    min_images, max_images, requires_face, min_faces,
    priority, is_active
) VALUES (
    'figurine_commercial',
    '🎭 피규어 만들기',
    'Commercial Figurine',
    '3d_figurine',
    'collectible',
    'Create a 1/7 scale commercialized figurine of the character in the picture, in a realistic style, in a real environment. The figurine is placed on a computer desk. The figurine has a round transparent acrylic base. The content on the computer screen is a 3D modeling process of this figurine. Next to the computer screen is a toy packaging box, designed in a style reminiscent of high-quality collectible figures, printed with original artwork. The packaging features two-dimensional flat illustrations of the figurine.',
    NULL,
    1, 1, true, 1,
    95, true
);

-- Template 13: 인형 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'yarn_doll',
    '🧸 손뜨개 인형',
    'Crocheted Yarn Doll',
    '3d_figurine',
    'handcraft',
    'A close-up, professionally composed photograph showcasing a hand-crocheted yarn doll gently cradled by two hands. The doll has a rounded shape, featuring the cute chibi image of the uploaded character, with vivid contrasting colors and rich details. The hands holding the doll are natural and gentle, with clearly visible finger postures, and natural skin texture and light/shadow transitions, conveying a warm and realistic touch. The background is slightly blurred, depicting an indoor environment with a warm wooden tabletop and natural light streaming in from a window, creating a comfortable and intimate atmosphere. The overall image conveys a sense of exquisite craftsmanship and cherished warmth.',
    1, 1, true, 85, true
);

-- Template 14: 히어로 피규어 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'plush_hero',
    '🦸 히어로 봉제인형',
    'Hero Plush Toy',
    '3d_figurine',
    'plush',
    'A soft, high-quality plush toy of provided photo, with an oversized head, small body, and stubby limbs. Made of fuzzy fabric with visible stitching and embroidered facial features. The plush is shown sitting or standing against a neutral background. The expression is cute or expressive, and it wears simple clothes or iconic accessories if relevant. Lighting is soft and even, with a realistic, collectible plush look. Centered, full-body view.',
    1, 1, true, 80, true
);

-- Template 15: 이모지 스티커 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'emoji_stickers',
    '😊 이모지 스티커 세트',
    'Emoji Sticker Pack',
    '3d_figurine',
    'sticker',
    'Making a playful peace sign with both hands and winking. Tearful eyes and slightly trembling lips, showing a cute crying expression. Arms wide open in a warm, enthusiastic hug pose. Lying on their side asleep, resting on a tiny pillow with a sweet smile. Pointing forward with confidence, surrounded by shining visual effects. Blowing a kiss, with heart symbols floating around. Maintain the chibi aesthetic. Exaggerated, expressive big eyes. Soft facial lines. Background: Vibrant red with star or colorful confetti elements for decoration. Leave some clean white space around each sticker. Aspect ratio: 9:16',
    1, 1, true, 75, true
);

-- Template 16: Funko 피규어 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'funko_pop',
    '🎮 Funko Pop 피규어',
    'Funko Pop Figure',
    '3d_figurine',
    'collectible',
    'Create a detailed 3D render of a chibi Funko Pop figure, strictly based on the provided reference photo. The figure should accurately reflect the person''s appearance, hairstyle, attire, and characteristic style from the photo. High detail, studio lighting, photorealistic texture, pure white background.',
    1, 1, true, 90, true
);

-- =============================================================================
-- CATEGORY: PORTRAIT STYLING (portrait_styling) - Templates 2-12, 38
-- =============================================================================

-- Template 2: 레드카펫
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'red_carpet',
    '🌟 레드카펫 스타일',
    'Red Carpet Portrait',
    'portrait_styling',
    'glamour',
    'This is a photo of me. Craft a moody studio portrait of the uploaded person bathed in a golden-orange spotlight that creates a glowing circular halo behind them on the wall. The warm light should sculpt the face and upper body with soft, sunset-like tones while casting a strong head shadow to the right. Style the person.',
    1, 1, true, 1, 92, true
);

-- Template 3: 밤 인물사진
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'night_portrait_paris',
    '🌃 파리의 밤 인물사진',
    'Night Portrait in Paris',
    'portrait_styling',
    'location',
    'Create an ultra-realistic night-time portrait from this photo, standing near the Arc de Triomphe at Place Charles de Gaulle in Paris. Background: The Arc de Triomphe is fully visible and brightly illuminated in the center of the frame, with deep shadows and warm street lights glowing softly in the background. Lighting & Color: Maintain the warm, ambient nighttime lighting with subtle yellow-orange glows from the streetlights. Pose & Angle: The subject is facing left, head tilted upward at a ~45-degree angle, with eyes closed and a serene, introspective expression.',
    1, 1, true, 1, 88, true
);

-- Template 4: 개선문
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'elegant_saree',
    '🎭 우아한 사리 스타일',
    'Elegant Saree Portrait',
    'portrait_styling',
    'cultural',
    'Make a 4K HD, realistic, and stunning portrait using this image. Show long, dark, wavy hair cascading over shoulders. Attire – a translucent, elegant black saree draped over one shoulder, revealing a fitted blouse underneath. White flowers are tucked behind her right ear. She is looking slightly to her right, with a soft, serene expression. The background is a plain, warm-toned wall, illuminated by a warm light source from the right.',
    1, 1, true, 1, 70, true
);

-- Template 5: 골든 인물사진
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'golden_vintage',
    '🌅 골든아워 빈티지',
    'Golden Hour Vintage',
    'portrait_styling',
    'vintage',
    'Create a retro, vintage, grainy but bright image of the reference picture, but draped in a perfect beige-colour, Pinterest-y aesthetic retro saree. It must feel like a 90s movie, brown hair, baddie with a small flower tucked visibly into her wavy hair, and a romantic, windy environment. The girl is standing against a solid wall, deep shadows and contrast drama, creating a mysterious and artistic atmosphere where the lighting is warm with the golden tones of evoking a sunset or golden hour glow.',
    1, 1, true, 1, 82, true
);

-- Template 6: 흑백 인물사진
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'dramatic_bw',
    '⚫ 드라마틱 흑백사진',
    'Dramatic Black & White',
    'portrait_styling',
    'artistic',
    'Make an epic black and white close-up portrait of the uploaded pic with wet hair and water droplets on my face and shoulders. Strong dramatic lighting, sharp facial features, glossy lips, piercing eyes, and realistic skin texture. High contrast, studio shot, hyper-realistic, cinematic look, 4K detail using this picture.',
    1, 1, true, 1, 85, true
);

-- Template 7: 헐리우드 (레트로, 남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'hollywood_70s',
    '🎬 70년대 헐리우드 스타',
    '1970s Hollywood Star',
    'portrait_styling',
    'retro',
    'Create a full-length photorealistic image of the uploaded person as a 1970s Hollywood superstar. Scene: outside a Hollywood cinema hall during a film premiere, with neon lights marquee, and vintage Hollywood posters on the walls. Style the subject in classic 70s hero fashion — a sharply tailored wide-collared suit with flared trousers, or a silk shirt left slightly unbuttoned paired with a patterned blazer.',
    1, 1, true, 1, 78, true
);

-- Template 8: 조명 인물 (남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'cinematic_suit',
    '🎩 시네마틱 수트 스타일',
    'Cinematic Suit Portrait',
    'portrait_styling',
    'fashion',
    'A hyper-realistic cinematic editorial portrait of the uploaded person (preserve face 100%). He stands tall in a dark, moody studio, surrounded by soft, drifting smoke under a dramatic spotlight. Outfit: Oversized slate-blue luxury suit with wide-leg trousers, paired with a slightly unbuttoned white silk shirt. Both hands tucked casually in pockets, shoulders relaxed, confident expression, head tilted slightly upward.',
    1, 1, true, 1, 83, true
);

-- Template 9: 빨간 장미 인물 (남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'rose_romantic',
    '🌹 로맨틱 로즈 스타일',
    'Romantic Rose Portrait',
    'portrait_styling',
    'romantic',
    'Create a hyper-realistic, editorial-style portrait of the man in the image with a dark, alluring aesthetic. He has tousled, slightly wavy black hair that falls over his forehead, framing his face. His expression is serious and intense, with dark, soulful eyes. He wears a sleek black suit over a deep red, partially unbuttoned dress shirt. A single long, gold earring dangles from one ear. A vivid red rose is pinned to the lapel.',
    1, 1, true, 1, 76, true
);

-- Template 10: 오렌지 조명 인물 (남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'orange_fashion',
    '🟠 오렌지 패션 화보',
    'Orange Fashion Editorial',
    'portrait_styling',
    'fashion',
    'Make a hyper-realistic portrait of the uploaded person (preserve face 100%) wearing a high-end fashion LV outfit. The background is orange, the clothing is minimal, as a hyper-realistic scene, the guy is just slightly visible due to dark shadows, and he is wearing modern fashion frames.',
    1, 1, true, 1, 74, true
);

-- Template 11: 실내 인물 (남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'soft_window_light',
    '☀️ 창가의 부드러운 빛',
    'Soft Window Light',
    'portrait_styling',
    'natural',
    'Create a softly lit portrait of the uploaded person standing indoors near a window with warm sunlight streaming through. Use a cinematic, golden-hour lighting style that highlights the face and hair with natural glow and soft shadows. The person should be wearing a loose, casual white shirt with slightly rolled-up sleeves. The mood should feel calm, dreamy, and natural.',
    1, 1, true, 1, 79, true
);

-- Template 12: 레트로 인물 (남자)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'retro_lounge',
    '🎷 레트로 라운지 스타일',
    '1970s Retro Lounge',
    'portrait_styling',
    'retro',
    'Create a hyper-realistic portrait of the uploaded person (preserve face 100%) styled as a 1970s retro icon. He is seated casually in a dimly lit lounge with vintage vinyl records stacked behind him, a glowing jukebox casting warm neon light across the scene. Outfit: open-collared patterned silk shirt, flared trousers, gold chain, and tinted aviator sunglasses.',
    1, 1, true, 1, 73, true
);

-- Template 38: 흑백 인물사진 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'bw_professional',
    '📷 프로페셔널 흑백',
    'Professional B&W Portrait',
    'portrait_styling',
    'professional',
    'Generate a top-angle and close-up black and white portrait of my face, focused on the head facing forward. Use a 35mm lens look, 10.7K 4HD quality. Proud expression. Deep black shadow background - only the face, the upper chest, and the shoulder.',
    1, 1, true, 1, 86, true
);

-- =============================================================================
-- CATEGORY: GAME/ANIMATION (game_animation) - Templates 17, 35
-- =============================================================================

-- Template 17: 리듬게임 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'rhythm_game',
    '🎮 리듬게임 캐릭터',
    'Rhythm Game Character',
    'game_animation',
    'game',
    'A vibrant rhythm dance game screenshot featuring the 3D animated character from the reference photo, keeping its unique style, hat, outfit, and confident dance pose. Immersive cinematic lighting with neon pink and purple glow, glossy reflective dance floor shining under spotlights, and dynamic 3D cartoon style. Rhythm game interface with immersive UI: score meter at the top, colorful music waveform animations synced to the beat.',
    1, 1, true, 72, true
);

-- Template 35: 16비트 게임 캐릭터 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'pixel_16bit',
    '👾 16비트 픽셀아트',
    '16-bit Pixel Art',
    'game_animation',
    'retro_game',
    'Create a detailed 16-bit pixel art character sprite based on the uploaded photo. The character should be in a dynamic pose, showcasing key features such as hairstyle, clothing, and accessories. Use a limited color palette typical of 16-bit games, with clear outlines and shading to give depth. The sprite should be suitable for use in a retro-style video game, with a resolution of 64x64 pixels.',
    1, 1, false, 68, true
);

-- =============================================================================
-- CATEGORY: IMAGE EDITING (image_editing) - Templates 18-33
-- =============================================================================

-- Template 18: 사진 여러개 합치기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'multi_merge',
    '🎨 다중 이미지 합성',
    'Multi-Image Merge',
    'image_editing',
    'composite',
    'Combine multiple images into a single cohesive image. Keep all key subjects recognizable and maintain their proportions and details. Blend the images naturally with consistent lighting, shadows, perspective, and style. Photorealistic, high-resolution, seamless integration.',
    2, 5, false, 91, true
);

-- Template 19: 옷 바꿔 입히기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'outfit_swap',
    '👔 의상 교체',
    'Outfit Swap',
    'image_editing',
    'fashion',
    'Keep the character in Image1 unchanged, but replace their outfit with the clothing in Image2. Maintain the same pose, body proportions, and facial features, while applying the color, texture, and style of the outfit in Image2. High-quality, realistic, consistent detail.',
    2, 2, true, 87, true
);

-- Template 20: 표정 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'expression_change',
    '😊 표정 변경',
    'Expression Change',
    'image_editing',
    'face',
    'Keep the person from Image1 unchanged, but change their facial expression to the desired emotion (smiling, surprised, angry). Preserve the pose, body proportions, hairstyle, and overall appearance. Maintain realistic lighting, shadows, and photorealistic details.',
    1, 1, true, 1, 81, true
);

-- Template 21: 몸짱 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'muscular_transform',
    '💪 근육질 변신',
    'Muscular Transform',
    'image_editing',
    'body',
    'Reshape the body of the person in this photo into a muscular physique. Keep the face, identity, hairstyle, and clothing consistent. Ensure realistic anatomy, natural proportions, and photorealistic details.',
    1, 1, true, 65, true
);

-- Template 22: 9장의 앨범 만들기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'album_9_photos',
    '📸 9장 앨범 생성',
    '9-Photo Album',
    'creative_transform',
    'album',
    'Using the uploaded photo as a reference, generate a set of 9 vibrant half-length portraits featuring natural life. Each portrait should show a different pose and be placed in a unique setting, with rich, colorful details that highlight the diversity of nature.',
    1, 1, true, 77, true
);

-- Template 23: 배경 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'background_replace',
    '🏞️ 배경 교체',
    'Background Replace',
    'image_editing',
    'background',
    'Replace the background of the image with a new environment (beach, forest, city skyline). Keep the main subject (person/object) unchanged, maintaining original proportions, lighting, and details. Ensure the subject blends naturally with the new environment. Photorealistic, high-resolution, seamless integration.',
    1, 1, false, 93, true
);

-- Template 24: 사물 추가하기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'object_add',
    '➕ 사물 추가',
    'Add Object',
    'image_editing',
    'composite',
    'Add a specific element (tree, lamp, dog) to the image. Place it naturally in the scene, matching the lighting, perspective, and style. Keep the original elements unchanged. Photorealistic, seamless integration.',
    1, 1, false, 71, true
);

-- Template 25: 사물 지우기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'object_remove',
    '➖ 사물 제거',
    'Remove Object',
    'image_editing',
    'cleanup',
    'Remove specified element (person, car, sign) from the image. Fill the background naturally to maintain the scene''s continuity, lighting, and details. Keep all other elements unchanged. Photorealistic, high-resolution.',
    1, 1, false, 84, true
);

-- Template 26: 카메라 앵글 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'camera_angle',
    '📐 카메라 앵글 변경',
    'Camera Angle Change',
    'image_editing',
    'perspective',
    'Change the camera angle of the image to a different perspective (top-down, side view, low angle). Maintain the original subject''s proportions, details, and lighting. Ensure the new perspective looks natural and realistic. High-resolution, photorealistic.',
    1, 1, false, 60, true
);

-- Template 27: 계절 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'season_change',
    '🍂 계절 변경',
    'Season Change',
    'image_editing',
    'environment',
    'Change the season in the image to (winter, autumn, spring). Adjust the environment, colors, and lighting to reflect the new season while keeping the main subject unchanged. Ensure a natural, photorealistic look.',
    1, 1, false, 66, true
);

-- Template 28: 글씨 고치기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'text_edit',
    '✏️ 텍스트 편집',
    'Text Edit',
    'image_editing',
    'text',
    'Edit the text in uploaded photo. Replace the existing text with new text while keeping the background, design, and other elements unchanged. Match the font style, size, and color to look natural and consistent with the image. Photorealistic, seamless integration.',
    1, 1, false, 55, true
);

-- Template 29: 옷만 추출하기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'clothing_extract',
    '👗 의상 추출',
    'Extract Clothing',
    'image_editing',
    'fashion',
    'Extract the clothing from uploaded photo and present it as a clean e-commerce product photo. Remove the model''s body completely. Keep the outfit in natural 3D shape, with realistic fabric folds, seams, and textures. Display the garment as if photographed on a mannequin or neatly laid flat, centered on a pure white or transparent background.',
    1, 1, false, 58, true
);

-- Template 30: 옷만 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'clothing_change',
    '👕 의상만 변경',
    'Clothing Change',
    'image_editing',
    'fashion',
    'Change the outfit of the person to a different style of clothing. Keep the same pose, body proportions, and facial features, while applying the new color, texture, and style. Ensure realistic fabric physics, lighting, and shadows. High-quality, photorealistic details.',
    1, 2, true, 69, true
);

-- Template 31: 헤어스타일 바꾸기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'hairstyle_change',
    '💇 헤어스타일 변경',
    'Hairstyle Change',
    'image_editing',
    'beauty',
    'Change the hairstyle of the person to match a different style. Keep the same face, body proportions, and clothing. Ensure the new hairstyle looks natural, with realistic hair texture, lighting, and shadows.',
    1, 2, true, 1, 67, true
);

-- Template 32: 화질 개선하기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'quality_enhance',
    '✨ 화질 개선',
    'Quality Enhancement',
    'image_editing',
    'enhancement',
    'Enhance uploaded photo to improve overall quality and detail. Keep the original composition, colors, and style intact. Increase resolution, sharpness, texture clarity, and lighting realism. Output as a photorealistic, high-resolution image.',
    1, 1, false, 89, true
);

-- Template 33: 사진 복원하기
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, priority, is_active
) VALUES (
    'photo_restore',
    '🔧 사진 복원',
    'Photo Restoration',
    'image_editing',
    'restoration',
    'Restore the uploaded old or damaged photo to a high-quality, clear image. Remove scratches, tears, discoloration, and noise while preserving the original composition, colors, and style. Enhance details, sharpness, and lighting for a photorealistic result.',
    1, 1, false, 64, true
);

-- =============================================================================
-- CATEGORY: CREATIVE TRANSFORM (creative_transform) - Templates 34, 36-37
-- =============================================================================

-- Template 34: 9장 스티커 사진
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'photo_strip_9',
    '📷 9장 스티커 사진',
    '3x3 Photo Strip',
    'creative_transform',
    'photo_booth',
    'Turn the photo into a 3x3 grid of photo strips with different studio-style poses and expressions.',
    1, 1, true, 1, 63, true
);

-- Template 36: 폴라로이드 합성 (연인 만들기)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'polaroid_couple',
    '💑 폴라로이드 커플',
    'Polaroid Couple',
    'creative_transform',
    'polaroid',
    'Create a realistic Polaroid-style photo featuring the person from the uploaded image alongside a partner. The couple should be posing closely together, smiling warmly, with natural body language that suggests affection. The background should be a casual, everyday setting like a park or café, with soft, natural lighting. The Polaroid frame should have a slightly faded, vintage look with handwritten text at the bottom.',
    1, 1, true, 1, 61, true
);

-- Template 37: 폴라로이드 합성 (가족 만들기)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'polaroid_family',
    '👨‍👩‍👧‍👦 폴라로이드 가족',
    'Polaroid Family',
    'creative_transform',
    'polaroid',
    'Create a realistic Polaroid-style photo featuring the person from the uploaded image alongside family members. The group should be posing closely together, smiling warmly, with natural body language that suggests affection. The background should be a casual, everyday setting like a park or home, with soft, natural lighting. The Polaroid frame should have a slightly faded, vintage look with handwritten text.',
    1, 1, true, 1, 62, true
);

-- =============================================================================
-- UPDATE STATISTICS
-- =============================================================================

-- Update template count
UPDATE prompt_templates
SET updated_at = NOW();

-- Create initial performance metrics for all templates
INSERT INTO template_performance_metrics (template_id, metric_date)
SELECT id, CURRENT_DATE
FROM prompt_templates;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    template_count INTEGER;
    category_stats RECORD;
BEGIN
    -- Count total templates
    SELECT COUNT(*) INTO template_count FROM prompt_templates;

    RAISE NOTICE '✅ Successfully inserted % prompt templates', template_count;
    RAISE NOTICE '';
    RAISE NOTICE '📊 Templates by Category:';

    -- Show category breakdown
    FOR category_stats IN
        SELECT category, COUNT(*) as count
        FROM prompt_templates
        GROUP BY category
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  - %: % templates', category_stats.category, category_stats.count;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '🎯 Top 10 Priority Templates:';

    -- Show top priority templates
    FOR category_stats IN
        SELECT template_name_ko, priority
        FROM prompt_templates
        ORDER BY priority DESC
        LIMIT 10
    LOOP
        RAISE NOTICE '  - % (Priority: %)', category_stats.template_name_ko, category_stats.priority;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready to use!';
END $$;