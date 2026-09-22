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
  Image,
  ImageSourcePropType
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;
const IMAGE_HEIGHT = isWeb ? 340 : Math.round(SCREEN_HEIGHT * 0.46);

interface Slide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  imageSource: ImageSourcePropType | { uri: string };
}

const SLIDES: Slide[] = [
  {
    id: '1',
    badge: '🌾 VENTE DIRECTE PRODUCTEUR',
    title: 'Achetez en direct des GIC du Cameroun',
    subtitle: 'Circuit court certifié MINADER',
    description: 'Accédez sans intermédiaire aux récoltes fraîches des coopératives agricoles certifiées. Prix équitables et traçabilité garantie.',
    imageSource: require('@/assets/images/onboarding-1.png'),
  },
  {
    id: '2',
    badge: '📊 INTELLIGENCE PRIX & CLIMAT',
    title: 'Comparez les cours du marché en direct',
    subtitle: 'Transparence & opportunités CEMAC',
    description: 'Suivez les tendances de prix par région et optimisez vos coûts d\'approvisionnement grâce à nos algorithmes d\'aide à la décision.',
    imageSource: { uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80' },
  },
  {
    id: '3',
    badge: '🚚 LOGISTIQUE HORS-LIGNE',
    title: 'Livraison rapide & commandes sécurisées',
    subtitle: 'Réseau P2P & Règlement en espèces',
    description: 'Commandez en toute confiance avec bordereau numérique QR et suivi chronologique des expéditions de l\'entrepôt au point de livraison.',
    imageSource: { uri: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=800&q=80' },
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
        {/* Section Image avec overlay fluide */}
        <View style={styles.imageContainer}>
          <Image 
            source={item.imageSource} 
            style={styles.slideImage} 
            resizeMode="cover"
          />
          {/* Ombre dégradée sur le bas de l'image pour la transition */}
          <View style={styles.imageBottomGradient} />
        </View>

        {/* Section Contenu avec transition élégante en superposition */}
        <View style={styles.contentContainer}>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          
          {/* Bouton Passer flottant en haut à droite */}
          <View style={styles.floatingHeader}>
            <TouchableOpacity onPress={handleSkip} style={styles.passerBadge} activeOpacity={0.85}>
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
            {/* Indicateurs de pagination */}
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
                  activeOpacity={0.8}
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
                {activeIndex === SLIDES.length - 1 ? 'Commencer la découverte' : 'Continuer'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#101e0f', // Uniformisé avec la barre de statut sombre
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#101e0f',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 12 : 16,
    right: 16,
    zIndex: 35,
  },
  passerBadge: {
    backgroundColor: 'rgba(16, 30, 15, 0.75)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 236, 216, 0.3)',
  },
  passerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f3ecd8',
    letterSpacing: 0.5,
  },
  listWrapper: {
    flex: 1,
    width: '100%',
  },
  slide: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: '#101e0f',
  },
  slideImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  imageBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(16, 30, 15, 0.4)',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -26,
    paddingHorizontal: Spacing.four,
    paddingTop: 22,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#101e0f',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 2,
  },
  badgeText: {
    color: '#d97834',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#101e0f',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97834',
    marginTop: -2,
  },
  description: {
    fontSize: 13,
    color: '#4b5548',
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 12,
    gap: 14,
    backgroundColor: '#f3ecd8',
    zIndex: 20,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#c7bea9',
  },
  activeIndicator: {
    width: 26,
    backgroundColor: '#d97834',
    borderRadius: 4,
  },
  orangeButton: {
    backgroundColor: '#d97834',
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
    fontWeight: '800',
    fontSize: 15,
  }
});
