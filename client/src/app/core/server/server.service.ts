import { map, share, switchMap, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Inject, Injectable, LOCALE_ID } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { Observable, ReplaySubject, of } from 'rxjs'
import { getCompleteLocale, ServerConfig } from '../../../../../shared'
import { About } from '../../../../../shared/models/server/about.model'
import { environment } from '../../../environments/environment'
import { VideoConstant, VideoPrivacy } from '../../../../../shared/models/videos'
import { isDefaultLocale } from '../../../../../shared/models/i18n'
import { getDevLocale, isOnDevLocale, peertubeTranslate } from '@app/shared/i18n/i18n-utils'

@Injectable()
export class ServerService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static BASE_LOCALE_URL = environment.apiUrl + '/client/locales/'
  private static CONFIG_LOCAL_STORAGE_KEY = 'server-config'

  configLoaded = new ReplaySubject<boolean>(1)
  videoPrivaciesLoaded = new ReplaySubject<boolean>(1)
  videoCategoriesLoaded = new ReplaySubject<boolean>(1)
  videoLicencesLoaded = new ReplaySubject<boolean>(1)
  videoLanguagesLoaded = new ReplaySubject<boolean>(1)
  localeObservable: Observable<any>

  private config: ServerConfig = {
    instance: {
      name: 'PeerTube',
      shortDescription: 'PeerTube, a federated (ActivityPub) video streaming platform  ' +
                        'using P2P (BitTorrent) directly in the web browser with WebTorrent and Angular.',
      defaultClientRoute: '',
      defaultNSFWPolicy: 'do_not_list' as 'do_not_list',
      customizations: {
        javascript: '',
        css: ''
      }
    },
    serverVersion: 'Unknown',
    signup: {
      allowed: false,
      allowedForCurrentIP: false
    },
    transcoding: {
      enabledResolutions: []
    },
    avatar: {
      file: {
        size: { max: 0 },
        extensions: []
      }
    },
    video: {
      image: {
        size: { max: 0 },
        extensions: []
      },
      file: {
        extensions: []
      }
    },
    user: {
      videoQuota: -1
    }
  }
  private videoCategories: Array<VideoConstant<number>> = []
  private videoLicences: Array<VideoConstant<number>> = []
  private videoLanguages: Array<VideoConstant<string>> = []
  private videoPrivacies: Array<VideoConstant<VideoPrivacy>> = []

  constructor (
    private http: HttpClient,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.loadServerLocale()
    this.loadConfigLocally()
  }

  loadConfig () {
    this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
        .pipe(tap(this.saveConfigLocally))
        .subscribe(data => {
          this.config = data

          this.configLoaded.next(true)
        })
  }

  loadVideoCategories () {
    return this.loadVideoAttributeEnum('categories', this.videoCategories, this.videoCategoriesLoaded, true)
  }

  loadVideoLicences () {
    return this.loadVideoAttributeEnum('licences', this.videoLicences, this.videoLicencesLoaded)
  }

  loadVideoLanguages () {
    return this.loadVideoAttributeEnum('languages', this.videoLanguages, this.videoLanguagesLoaded, true)
  }

  loadVideoPrivacies () {
    return this.loadVideoAttributeEnum('privacies', this.videoPrivacies, this.videoPrivaciesLoaded)
  }

  getConfig () {
    return this.config
  }

  getVideoCategories () {
    return this.videoCategories
  }

  getVideoLicences () {
    return this.videoLicences
  }

  getVideoLanguages () {
    return this.videoLanguages
  }

  getVideoPrivacies () {
    return this.videoPrivacies
  }

  getAbout () {
    return this.http.get<About>(ServerService.BASE_CONFIG_URL + '/about')
  }

  private loadVideoAttributeEnum (
    attributeName: 'categories' | 'licences' | 'languages' | 'privacies',
    hashToPopulate: VideoConstant<number | string>[],
    notifier: ReplaySubject<boolean>,
    sort = false
  ) {
    this.localeObservable
        .pipe(
          switchMap(translations => {
            return this.http.get(ServerService.BASE_VIDEO_URL + attributeName)
                       .pipe(map(data => ({ data, translations })))
          })
        )
        .subscribe(({ data, translations }) => {
          Object.keys(data)
                .map(dataKey => parseInt(dataKey, 10))
                .forEach(dataKey => {
                  const label = data[ dataKey ]

                  hashToPopulate.push({
                    id: dataKey,
                    label: peertubeTranslate(label, translations)
                  })
                })

          if (sort === true) {
            hashToPopulate.sort((a, b) => {
              if (a.label < b.label) return -1
              if (a.label === b.label) return 0
              return 1
            })
          }

          notifier.next(true)
        })
  }

  private loadServerLocale () {
    const completeLocale = isOnDevLocale() ? getDevLocale() : getCompleteLocale(this.localeId)

    // Default locale, nothing to translate
    if (isDefaultLocale(completeLocale)) {
      this.localeObservable = of({}).pipe(share())
      return
    }

    this.localeObservable = this.http
                                  .get(ServerService.BASE_LOCALE_URL + completeLocale + '/server.json')
                                  .pipe(share())
  }

  private saveConfigLocally (config: ServerConfig) {
    peertubeLocalStorage.setItem(ServerService.CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config))
  }

  private loadConfigLocally () {
    const configString = peertubeLocalStorage.getItem(ServerService.CONFIG_LOCAL_STORAGE_KEY)

    if (configString) {
      try {
        const parsed = JSON.parse(configString)
        Object.assign(this.config, parsed)
      } catch (err) {
        console.error('Cannot parse config saved in local storage.', err)
      }
    }
  }
}
