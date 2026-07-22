import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Dimensions, 
  TouchableOpacity, 
  FlatList, 
  NativeScrollEvent, 
  NativeSyntheticEvent,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;
// Hauteur fixe garantie pour l'image (évite tout affaissement sur React Native Web)
const IMAGE_HEIGHT = isWeb ? 340 : Math.round(SCREEN_HEIGHT * 0.45);

interface Slide {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Achetez directement auprès des agriculteurs',
    description: 'Accédez à des produits agricoles frais, cultivés localement par des GIC certifiés du Cameroun et de la CEMAC.',
    imageUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '2',
    title: 'Comparez les prix en temps réel',
    description: 'Consultez les prix du marché et commandez les meilleures récoltes disponibles selon votre région.',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '3',
    title: 'Livraison rapide partout au Cameroun',
    description: 'Recevez vos commandes à domicile ou récupérez-les dans nos points de collecte partenaires..',
    imageUrl: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=800&q=80',
  }
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const router = useRouter();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / CONTAINER_WIDTH);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * CONTAINER_WIDTH,
        animated: true,
      });
    } else {
      handleSkip();
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/welcome');
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    return (
      <View style={styles.slide}>
        {/* Section Image avec hauteur fixe garantie */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.slideImage} 
            resizeMode="cover"
          />
        </View>

        {/* Section Contenu (Titre & Description) */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        
        {/* Bouton Passer flottant en haut à droite */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity onPress={handleSkip} style={styles.passerBadge} activeOpacity={0.8}>
            <Text style={styles.passerText}>Passer</Text>
          </TouchableOpacity>
        </View>

        {/* Carrousel de Slides */}
        <View style={styles.listWrapper}>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderSlide}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: CONTAINER_WIDTH,
              offset: CONTAINER_WIDTH * index,
              index,
            })}
            snapToInterval={CONTAINER_WIDTH}
            decelerationRate="fast"
            style={{ width: CONTAINER_WIDTH }}
          />
        </View>

        {/* Zone inférieure (Dots + Bouton Orange) */}
        <View style={styles.footer}>
          {/* Indicateurs de pagination (Dots) */}
          <View style={styles.indicatorContainer}>
            {SLIDES.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setActiveIndex(index);
                  flatListRef.current?.scrollToOffset({
                    offset: index * CONTAINER_WIDTH,
                    animated: true,
                  });
                }}
              >
                <View
                  style={[
                    styles.indicator,
                    activeIndex === index ? styles.activeIndicator : null,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Bouton Orange Continuer / Commencer */}
          <TouchableOpacity onPress={handleNext} style={styles.orangeButton} activeOpacity={0.85}>
            <Text style={styles.orangeButtonText}>
              {activeIndex === SLIDES.length - 1 ? 'Commencer' : 'Continuer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: isWeb ? '#222222' : '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    alignSelf: 'center',
    shadowColor: isWeb ? '#000000' : 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: isWeb ? 10 : 0,
    position: 'relative',
    overflow: 'hidden',
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    right: 20,
    zIndex: 25,
  },
  passerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  passerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  listWrapper: {
    flex: 1,
    width: '100%',
  },
  slide: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
  },
  imageContainer: {
    height: IMAGE_HEIGHT, // 340px fixe garanti
    width: '100%',
    position: 'relative',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  slideImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  contentContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#101e0f',
    textAlign: 'left',
    lineHeight: 28,
  },
  description: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'left',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Platform.OS === 'ios' ? Spacing.five : Spacing.four,
    gap: Spacing.three,
    backgroundColor: '#ffffff',
    zIndex: 20,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  indicator: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  activeIndicator: {
    width: 22,
    backgroundColor: '#d97834', // Orange officiel Figma
    borderRadius: 4,
  },
  orangeButton: {
    backgroundColor: '#d97834', // Orange officiel Figma
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  orangeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  }
});
